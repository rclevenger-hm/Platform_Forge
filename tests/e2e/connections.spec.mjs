import { test, expect } from '@playwright/test';

async function prepare(page, delayedPath = 'capabilities', authAvailable = false) {
  // Deliberately ignore abort to exercise late responses already queued by a transport.
  await page.addInitScript(({ delayedPath, authAvailable }) => {
    const original = window.fetch.bind(window);
    window.connectionReplies = [];
    window.connectionCalls = [];
    window.fetch = (url, options) => {
      if (!String(url).startsWith('https://backend-a.test/api/')) return original(url, options);
      const path = String(url).split('/api/')[1];
      window.connectionCalls.push(path);
      if (path !== delayedPath) return Promise.resolve(new Response(JSON.stringify({available: authAvailable})));
      return new Promise(resolve => window.connectionReplies.push((fail = false) => resolve(new Response(
        JSON.stringify(fail ? {error: 'Old backend failed'} : path === 'auth/status' ? {available: true} : {connected:true,tutor:true,runner:false}),
        {status: fail ? 503 : 200, headers: {'Content-Type':'application/json'}}
      ))));
    };
  }, { delayedPath, authAvailable });
  await page.goto('./#Settings');
  await page.getByLabel('Platform Forge backend URL').fill('https://backend-a.test');
  await page.getByRole('button', {name:'Check connection',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.connectionReplies.length)).toBe(1);
}
async function release(page, fail = false) {
  await page.evaluate(fail => window.connectionReplies.shift()(fail), fail);
  // A following task runs after the response promise and React updates have settled.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
}

for (const fail of [false, true]) {
  test(`disconnect ignores a late connection ${fail ? 'failure' : 'success'}`, async ({page}) => {
    await prepare(page);
    await page.getByRole('button', {name:'Disconnect',exact:true}).click();
    await release(page, fail);
    await expect(page.getByRole('status')).toHaveText('Disconnected. Standalone learning remains available.');
    await expect(page.getByRole('button', {name:'Check connection',exact:true})).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel('Platform Forge backend URL')).toHaveValue('');
  });
}

test('leaving Settings cancels a pending check without saving its backend', async ({page}) => {
  await prepare(page);
  await page.getByRole('button', {name:'Campaign',exact:true}).click();
  await release(page);
  await page.getByRole('button', {name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Platform Forge backend URL')).toHaveValue('');
});

test('disconnect during auth discovery prevents the next capabilities request', async ({page}) => {
  await prepare(page, 'auth/status');
  await page.getByRole('button', {name:'Disconnect',exact:true}).click();
  await release(page);
  expect(await page.evaluate(() => window.connectionCalls)).toEqual(['auth/status']);
  await expect(page.getByRole('status')).toContainText('Disconnected.');
});

test('late completion cannot overwrite a newer successful backend connection', async ({page}) => {
  await prepare(page);
  await page.getByRole('button', {name:'Disconnect',exact:true}).click();
  await page.route('https://backend-b.test/api/**', route => route.fulfill({json: route.request().url().endsWith('auth/status')
    ? {available:false} : {connected:true,tutor:false,runner:true,runnerLanguages:['python']}}));
  await page.getByLabel('Platform Forge backend URL').fill('https://backend-b.test');
  await page.getByRole('button', {name:'Check connection',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Backend connected.');
  await release(page);
  await page.reload();
  await expect(page.getByLabel('Platform Forge backend URL')).toHaveValue('https://backend-b.test');
});

test('stale completion leaves a replacement check pending until its own reply', async ({page}) => {
  await prepare(page);
  await page.getByRole('button', {name:'Disconnect',exact:true}).click();
  await page.getByLabel('Platform Forge backend URL').fill('https://backend-a.test');
  await page.getByRole('button', {name:'Check connection',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.connectionReplies.length)).toBe(2);
  await release(page);
  await expect(page.getByRole('button', {name:'Checking endpoints…',exact:true})).toBeDisabled();
  await release(page);
  await expect(page.getByRole('status')).toContainText('Backend connected.');
});

test('cancelled capability failure does not restore account-only fallback', async ({page}) => {
  await prepare(page, 'capabilities', true);
  await page.getByRole('button', {name:'Disconnect',exact:true}).click();
  await release(page, true);
  await expect(page.getByRole('status')).toContainText('Disconnected.');
  await page.reload();
  await expect(page.getByLabel('Platform Forge backend URL')).toHaveValue('');
});
