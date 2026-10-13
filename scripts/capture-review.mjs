import { mkdir, readFile, writeFile } from 'node:fs/promises';
const folder = 'test-results/previews';
const dataUrl = async path => `data:image/png;base64,${(await readFile(path)).toString('base64')}`;
export async function captureReview(page, missions) {
  await mkdir(folder, {recursive:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('./');
  await page.getByRole('heading', {name:/Build confidence/}).waitFor();
  await page.screenshot({path:`${folder}/home.png`});
  await page.screenshot({path:`${folder}/home-full.png`,fullPage:true});
  await page.getByRole('button', {name:'Campaign',exact:true}).click();
  await page.getByRole('button', {name:/M12 The midnight backup/}).click();
  await page.screenshot({path:`${folder}/mission.png`});
  await page.screenshot({path:`${folder}/mission-full.png`,fullPage:true});
  await page.getByRole('button', {name:'Design Lab',exact:true}).click();
  await page.screenshot({path:`${folder}/design.png`});
  await page.screenshot({path:`${folder}/design-full.png`,fullPage:true});
  await page.getByRole('button', {name:'Author',exact:true}).click();
  await page.screenshot({path:`${folder}/author.png`});
  const fixture = ['M07','M16','M06','M09'].map((id,i) => {
    const m = missions.find(x => x.id === id);
    return {id:`visual-fixture-${i}`,missionId:id,missionVersion:m.version,concepts:m.concepts,passed:true,hints:id === 'M06' ? 1 : 0,mode:m.kind === 'python' ? 'browser Python' : 'browser simulation',at:`2026-01-0${i+1}T00:00:00Z`};
  });
  await page.evaluate(attempts => {
    const p = JSON.parse(localStorage.getItem('platform-forge:v1'));
    p.attempts = attempts; localStorage.setItem('platform-forge:v1',JSON.stringify(p));
  },fixture);
  await page.goto('./#Review'); await page.reload();
  await page.getByRole('heading', {name:'Make the idea stick.'}).waitFor();
  await page.screenshot({path:`${folder}/review.png`});
  const notes = {
    home:['Campaign, navigation, lime actions and Relay service map are implemented.','The daily-plan rail and richer campaign illustration remain design targets.'],
    mission:['Authored briefing, editable exercise, hints, explanation and evidence are implemented.','The concept’s tabbed incident console and full Linux lab lifecycle are later milestones.'],
    design:['Interactive capacity controls, failure injection and saved design rationale are implemented.','An editable component canvas and queue/backpressure simulation remain on the roadmap.'],
  };
  for (const name of ['home','mission','design']) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Platform Forge · ${name} comparison</title><style>
      *{box-sizing:border-box}body{margin:0;padding:46px;background:#0a141d;color:#e7f0f4;font-family:Arial,sans-serif}h1{font-size:34px;margin:12px 0 8px}header p{color:#a9beca;font-size:19px}small{font-size:14px;letter-spacing:2px;color:#c2f36b}.pair{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:28px}figure{margin:0;background:#112330;border:1px solid #284350;border-radius:14px;overflow:hidden}figcaption{padding:20px;font-weight:bold;font-size:22px}img{width:100%;display:block}.note{font-size:19px;line-height:1.5;padding:0 20px 22px;color:#bbccd5}footer{font-size:16px;color:#8fa5b2;margin-top:25px}
      </style></head><body><header><small>PLATFORM FORGE / v0.2 VISUAL REVIEW</small><h1>${name === 'home' ? 'Home: the learning journey' : name === 'mission' ? 'Practice: from briefing to evidence' : 'Design Lab: reason about a system'}</h1><p>Original design intent alongside the working standalone product.</p></header><div class="pair"><figure><figcaption>EXPECTED · Original AI-generated concept</figcaption><img src="${await dataUrl(`docs/design-concepts/${name}.png`)}"><p class="note">${notes[name][1]}</p></figure><figure><figcaption>IMPLEMENTED · Actual browser screenshot</figcaption><img src="${await dataUrl(`${folder}/${name}.png`)}"><p class="note">${notes[name][0]}</p></figure></div><footer>Actual capture: 1440 × 1000 CSS pixels · no LLM connected · capture source: production build in GitHub Actions</footer></body></html>`;
    await writeFile(`${folder}/comparison-${name}.html`,html);
    await page.setViewportSize({width:2400,height:1300});
    await page.setContent(html);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await page.screenshot({path:`${folder}/comparison-${name}.png`,fullPage:true});
  }
}
