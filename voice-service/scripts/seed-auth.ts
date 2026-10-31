// Creates a Supabase Auth user for every seeded profile and links it.
// Run after supabase/schema.sql:  npm run seed:auth
// Accounts: maya@sanjeevni.demo, jordan@sanjeevni.demo, sam@sanjeevni.demo, bedside-room-8@sanjeevni.demo, ...
// Password: DEMO_PASSWORD from .env (default "sanjeevni-demo"). Safe to run twice.

import { createClient } from "@supabase/supabase-js"
import { config, hasSupabase } from "../src/config.ts"
import { LOCAL_PROFILES } from "../src/contracts.ts"
import { demoEmail } from "../src/supabase.ts"

if (!hasSupabase()) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.")
  process.exit(1)
}

const admin = createClient(config.supabaseUrl!, config.supabaseServiceKey!, { auth: { persistSession: false } })

const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 })
if (listError) throw listError
const byEmail = new Map(existing.users.map((u) => [u.email, u.id]))

for (const profile of LOCAL_PROFILES) {
  const email = demoEmail(profile.id)
  let userId = byEmail.get(email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: config.demoPassword,
      email_confirm: true,
      user_metadata: { profile_id: profile.id, role: profile.role },
    })
    if (error) throw new Error(`${email}: ${error.message}`)
    userId = data.user.id
  }
  const { error } = await admin.from("profiles").update({ auth_user_id: userId }).eq("id", profile.id)
  if (error) throw new Error(`profiles.${profile.id}: ${error.message} (did you run supabase/schema.sql?)`)
  console.log(`✅ ${email} → ${profile.role}${profile.pod_id ? " " + profile.pod_id : ""}${profile.room ? " " + profile.room : ""}`)
}
