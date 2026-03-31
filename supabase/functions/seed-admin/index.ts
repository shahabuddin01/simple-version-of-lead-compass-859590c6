import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { email, password, full_name } = await req.json();

    // Try to create user, if exists update password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    let userId: string;

    if (createError && createError.message.includes("already been registered")) {
      // Find existing user and update password
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const existing = users?.find(u => u.email === email);
      if (!existing) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUser(userId, { password, email_confirm: true });
    } else if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      userId = newUser.user!.id;
    }

    // Ensure profile exists
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId, full_name: full_name || "Admin", email,
    }, { onConflict: "user_id" });

    // Ensure admin role
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId, role: "admin",
    }, { onConflict: "user_id,role" });

    return new Response(JSON.stringify({ success: true, userId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
