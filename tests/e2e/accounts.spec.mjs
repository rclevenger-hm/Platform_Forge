import {test,expect} from '@playwright/test';
const backend='http://127.0.0.1:8789';
const password='Unique browser test passphrase';
async function connect(page) {
  await page.goto('./#Settings');
  await page.getByLabel('Platform Forge backend URL').fill(backend);
  await page.getByRole('button',{name:'Check connection'}).click();
  await expect(page.getByText('Backend connected. Sign in from Account to save your progress.')).toBeVisible();
  await page.getByRole('button',{name:'Account',exact:true}).click();
}
async function signIn(page,username,register=false) {
  if(register) await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByRole('textbox',{name:'Username',exact:true}).fill(username);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:register?'Create my account':'Sign in to my account',exact:true}).click();
  await expect(page.getByRole('heading',{name:`Welcome, ${username}.`})).toBeVisible();
}
async function saved(page) {
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await expect(page.getByText('Progress saved',{exact:true})).toBeVisible();
}
test('real account login, guest import, cross-device sync and logout keep learner work separate',async({page,browser})=>{
  const username='learner_'+Date.now();
  await page.goto('./#Practice%2FM01');
  await page.getByLabel('Mission notes').fill('Guest note stays on this device.');
  await connect(page); await signIn(page,username,true);
  await page.getByRole('button',{name:'Import guest progress'}).click();
  await expect(page.getByText('Progress saved',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await expect(page.getByLabel('Mission notes')).toHaveValue('Guest note stays on this device.');
  await page.getByLabel('Mission notes').fill('Account note follows this learner.');
  await saved(page);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173/Platform_Forge/'});
  try {
    const second=await context.newPage();
    await connect(second); await signIn(second,username);
    await second.getByRole('button',{name:'Practice',exact:true}).click();
    await expect(second.getByLabel('Mission notes')).toHaveValue('Account note follows this learner.');
    await second.reload();
    await expect(second.getByLabel('Mission notes')).toHaveValue('Account note follows this learner.');
  } finally {await context.close();}
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByText('Signed out. Guest progress is separate from your account.')).toBeVisible();
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await expect(page.getByLabel('Mission notes')).toHaveValue('Guest note stays on this device.');
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await signIn(page,'other_'+Date.now(),true);
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await expect(page.getByLabel('Mission notes')).toHaveValue('');
});
test('concurrent account updates require an explicit choice and an outage retains device work',async({page})=>{
  const username='conflict_'+Date.now();
  await connect(page); await signIn(page,username,true);
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await page.getByLabel('Mission notes').fill('Original account work.'); await saved(page);
  const auth=await (await page.request.get(backend+'/api/auth/status')).json();
  const remote=await (await page.request.get(backend+'/api/account/progress')).json();
  remote.progress.notes.M01='Work saved on another device.';
  const changed=await page.request.post(backend+'/api/account/progress',{headers:{'X-Forge-Client':'1','X-CSRF-Token':auth.csrf},data:{revision:remote.revision,progress:remote.progress}});
  expect(changed.status()).toBe(200);
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await page.getByLabel('Mission notes').fill('This device has different work.');
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await expect(page.getByText('Two copies need your attention')).toBeVisible();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export device copy'}).click();
  expect((await download).suggestedFilename()).toBe('platform-forge-device-backup.json');
  await page.getByRole('button',{name:'Use server copy',exact:true}).click();
  await expect(page.getByText('Progress saved',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Practice',exact:true}).click();
  await expect(page.getByLabel('Mission notes')).toHaveValue('Work saved on another device.');
  await page.route('**/api/account/progress',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Storage temporarily offline.'}}):route.continue());
  await page.getByLabel('Mission notes').fill('Keep this offline work.');
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await expect(page.getByText('Storage temporarily offline.')).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('platform-forge:account:')).some(k=>JSON.parse(localStorage[k]).progress.notes.M01==='Keep this offline work.'))).toBe(true);
  await page.unroute('**/api/account/progress');
  await page.getByRole('button',{name:'Retry sync'}).click();
  await expect(page.getByText('Progress saved',{exact:true})).toBeVisible();
});
test('Pages guest account screen explains the backend requirement on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./#Account');
  await expect(page.getByRole('heading',{name:'Connect a backend to sign in'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
