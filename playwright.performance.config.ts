import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"tests/performance",workers:1,timeout:1200000,use:{baseURL:"http://127.0.0.1:3100",channel:"chrome",headless:true,trace:"off"},webServer:[
 {command:"node tests/support/supabase-fixture.mjs",url:"http://127.0.0.1:54329/health",reuseExistingServer:false,timeout:60000,env:{PERFORMANCE_FIXTURE:"1"}},
 {command:"node scripts/performance-server.mjs",url:"http://127.0.0.1:3100/login",reuseExistingServer:false,timeout:300000,env:{SAFE_EXAM_TEST_BUILD:"1",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54329",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-public-key",SUPABASE_SECRET_KEY:"fixture-server-secret",NEXT_PUBLIC_APP_URL:"http://127.0.0.1:3100"}},
]});
