import {createClient} from "@supabase/supabase-js";
export function db(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!u||!k)throw Error("Missing Supabase environment variables");return createClient(u,k,{auth:{autoRefreshToken:false,persistSession:false}})}
