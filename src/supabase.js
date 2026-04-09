import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.\n" +
      "If running via Claude Desktop, set these in claude_desktop_config.json under mcpServers.learntube-ai-readiness.env\n" +
      "If running locally, create a .env file from .env.example"
  );
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
