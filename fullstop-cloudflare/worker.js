export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS / preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // Authentication API
    if (url.pathname === "/api/auth.php") {
      return handleAuth(request, env);
    }

    // Static website
    return env.ASSETS.fetch(request);
  }
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

async function handleAuth(request, env) {
  const headers = corsHeaders();

  try {
    // --------------------------------------------------
    // GET — session check
    // --------------------------------------------------
    if (request.method === "GET") {
      return json({
        success: false,
        message: "Not logged in."
      }, 401, headers);
    }

    // --------------------------------------------------
    // POST — login
    // --------------------------------------------------
    if (request.method === "POST") {
      const body = await request.json();

      const loginId = String(body.login_id || "").trim();
      const password = String(body.password || "").trim();

      if (!loginId || !password) {
        return json({
          success: false,
          message: "Login ID and password are required."
        }, 400, headers);
      }

      const user = await env.fullstop_db
        .prepare(`
          SELECT
            id,
            login_id,
            password_hash,
            role,
            name,
            location,
            is_active
          FROM users
          WHERE login_id = ?
          LIMIT 1
        `)
        .bind(loginId)
        .first();

      if (!user) {
        return json({
          success: false,
          message: "Invalid Login ID or password. Please try again."
        }, 401, headers);
      }

      if (Number(user.is_active) === 0) {
        return json({
          success: false,
          message: "Sorry this account has been terminated. Please contact admin."
        }, 401, headers);
      }

      const valid = await verifyPassword(
        password,
        user.password_hash
      );

      if (!valid) {
        return json({
          success: false,
          message: "Invalid Login ID or password. Please try again."
        }, 401, headers);
      }

      return json({
        success: true,
        message: "Login successful.",
        data: {
          id: user.id,
          login_id: user.login_id,
          role: user.role,
          name: user.name,
          location: user.location
        }
      }, 200, headers);
    }

    // --------------------------------------------------
    // DELETE — logout
    // --------------------------------------------------
    if (request.method === "DELETE") {
      return json({
        success: true,
        message: "Logged out successfully.",
        data: []
      }, 200, headers);
    }

    return json({
      success: false,
      message: "Method not allowed."
    }, 405, headers);

  } catch (error) {
    console.error("AUTH ERROR:", error);

    return json({
      success: false,
      message: "Server error: " + error.message
    }, 500, headers);
  }
}


// ======================================================
// PBKDF2 password verification
// Database format:
//
// pbkdf2$SALT$HASH
// ======================================================

async function verifyPassword(password, stored) {
  if (!stored) {
    return false;
  }

  const parts = stored.split("$");

  if (parts.length !== 3) {
    return false;
  }

  if (parts[0] !== "pbkdf2") {
    return false;
  }

  const salt = parts[1];
  const expectedHex = parts[2];

  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    {
      name: "PBKDF2"
    },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  const bytes = new Uint8Array(derivedBits);

  let actualHex = "";

  for (const byte of bytes) {
    actualHex += byte.toString(16).padStart(2, "0");
  }

  return actualHex === expectedHex;
}


// ======================================================
// JSON response helper
// ======================================================

function json(data, status, headers) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers
    }
  );
}
