import { createClient } from '@supabase/supabase-js';
import { setTimeout as sleep } from 'node:timers/promises';

const url = process.env['SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const anonKey = process.env['SUPABASE_ANON_KEY'];
if (!url || !serviceKey || !anonKey) throw new Error('Supabase smoke-test environment is incomplete');

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const browser = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const existingIssueId = process.env['SMOKE_EXISTING_ISSUE_ID'];
let issueId: string;
let publicId: string;

if (existingIssueId) {
  const { data, error } = await admin
    .from('issues')
    .select('id,public_id')
    .eq('id', existingIssueId)
    .single();
  if (error) throw new Error(`existing smoke issue was not found: ${error.message}`);
  issueId = data.id;
  publicId = data.public_id;
} else {
  const nonce = Date.now();
  const email = `pipeline-smoke-${nonce}@example.com`;
  const password = `Smoke-${crypto.randomUUID()}!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Pipeline smoke citizen' },
  });
  if (createError || !created.user) throw new Error(`smoke user creation failed: ${createError?.message}`);
  const { error: signInError } = await browser.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`smoke sign-in failed: ${signInError.message}`);
  const { data: accepted, error: submitError } = await browser.rpc('submit_citizen_report', {
    p_client_report_id: crypto.randomUUID(),
    p_description: 'A large pothole is damaging bikes outside the school gate.',
    p_lat: 12.9716,
    p_lng: 77.5946,
    p_location_precision: 'POINT',
    p_location_visibility: 'APPROXIMATE',
    p_is_anonymous: true,
  });
  if (submitError || !accepted?.[0]) throw new Error(`smoke report submission failed: ${submitError?.message}`);
  issueId = accepted[0].issue_id as string;
  publicId = accepted[0].public_id as string;

  const { error: commentError } = await browser.rpc('add_citizen_comment', {
    p_issue_id: issueId,
    p_content: 'Smoke test confirms citizen discussion reaches the real issue.',
  });
  if (commentError) throw new Error(`smoke comment failed: ${commentError.message}`);

  const { data: supported, error: supportError } = await browser.rpc('toggle_issue_support', {
    p_issue_id: issueId,
  });
  if (supportError || supported !== true) throw new Error(`smoke support failed: ${supportError?.message}`);

  // Reporters auto-follow. Toggle off and on to prove both transitions.
  const { error: unfollowError } = await browser.rpc('toggle_issue_follow', { p_issue_id: issueId });
  if (unfollowError) throw new Error(`smoke unfollow failed: ${unfollowError.message}`);
  const { data: followed, error: followError } = await browser.rpc('toggle_issue_follow', {
    p_issue_id: issueId,
  });
  if (followError || followed !== true) throw new Error(`smoke follow failed: ${followError?.message}`);
}
for (let attempt = 0; attempt < 30; attempt += 1) {
  const { data: runs, error } = await admin
    .from('agent_runs')
    .select('agent_name,status,model')
    .eq('issue_id', issueId)
    .eq('status', 'SUCCESS');
  if (error) throw new Error(`smoke agent read failed: ${error.message}`);
  const names = new Set((runs ?? []).map((run) => run.agent_name));
  if (names.has('intake') && names.has('cluster')) {
    console.info(JSON.stringify({
      public_id: publicId,
      issue_id: issueId,
      successful_agents: [...names],
      models: (runs ?? []).map((run) => run.model),
    }));
    process.exit(0);
  }
  await sleep(1_000);
}

throw new Error(`agents did not complete for smoke issue ${issueId}`);
