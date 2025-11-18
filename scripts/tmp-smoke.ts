import { POST as runStepPost } from '../src/app/api/agent/run-step/route';
import { POST as runAllPost } from '../src/app/api/agent/run-all/route';

async function run() {
  const invalidRunStepReq = new Request('http://localhost/api/agent/run-step', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  const runStepRes = await runStepPost(invalidRunStepReq);
  console.log('run-step invalid status:', runStepRes.status);
  console.log('run-step invalid body:', await runStepRes.json());

  const invalidRunAllReq = new Request('http://localhost/api/agent/run-all', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5.1-2025-11-13' }),
  });

  const runAllRes = await runAllPost(invalidRunAllReq);
  console.log('run-all invalid status:', runAllRes.status);
  console.log('run-all invalid body:', await runAllRes.json());
}

run().catch((error) => {
  console.error('Smoke tests failed:', error);
  process.exitCode = 1;
});

