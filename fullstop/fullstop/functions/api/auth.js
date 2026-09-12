function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...headers
        }
    });
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
        const [key, ...value] = cookie.trim().split("=");
        if (key === name) {
            return decodeURIComponent(value.join("="));
        }
    }

    return null;
}

function generateSessionId() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);

    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    return Array.from(new Uint8Array(bits))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

async function verifyPassword(password, storedHash) {
    /*
     * New format:
     * pbkdf2$salt$hash
     */
    if (!storedHash || !storedHash.startsWith("pbkdf2$")) {
        return false;
    }

    const parts = storedHash.split("$");

    if (parts.length !== 3) {
        return false;
    }

    const salt = parts[1];
    const expectedHash = parts[2];

    const actualHash = await hashPassword(password, salt);

    return actualHash === expectedHash;
}

function safeUser(user) {
    return {
        id: user.id,
        login_id: user.login_id,
        role: user.role,
        name: user.name,
        location: user.location
    };
}

export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method;

    // ---------------------------------------------------------
    // GET — Check current session
    // ---------------------------------------------------------
    if (method === "GET") {
        const sessionId = getCookie(request, "fs_session");

        if (!sessionId) {
            return json({
                success: false,
                message: "Not logged in."
            }, 401);
        }

        const session = await env.fullstop_db.prepare(`
            SELECT
                sessions.id,
                sessions.expires_at,
                users.id AS user_id,
                users.login_id,
                users.role,
                users.name,
                users.location,
                users.is_active
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.id = ?
            LIMIT 1
        `).bind(sessionId).first();

        if (!session || session.expires_at <= Math.floor(Date.now() / 1000)) {
            await env.fullstop_db
                .prepare("DELETE FROM sessions WHERE id = ?")
                .bind(sessionId)
                .run();

            return json({
                success: false,
                message: "Session expired."
            }, 401);
        }

        if (!session.is_active) {
            await env.fullstop_db
                .prepare("DELETE FROM sessions WHERE id = ?")
                .bind(sessionId)
                .run();

            return json({
                success: false,
                message: "Sorry this account has been terminated.\nPlease contact admin."
            }, 401);
        }

        return json({
            success: true,
            message: "Session active.",
            data: {
                id: session.user_id,
                login_id: session.login_id,
                role: session.role,
                name: session.name,
                location: session.location
            }
        });
    }

    // ---------------------------------------------------------
    // POST — Login
    // ---------------------------------------------------------
    if (method === "POST") {
        let body;

        try {
            body = await request.json();
        } catch {
            return json({
                success: false,
                message: "Invalid request."
            }, 400);
        }

        const loginId = String(body.login_id || "").trim();
        const password = String(body.password || "").trim();

        if (!loginId || !password) {
            return json({
                success: false,
                message: "Login ID and password are required."
            }, 400);
        }

        const user = await env.fullstop_db.prepare(`
            SELECT *
            FROM users
            WHERE login_id = ?
            LIMIT 1
        `).bind(loginId).first();

        if (!user || !(await verifyPassword(password, user.password_hash))) {
            return json({
                success: false,
                message: "Invalid Login ID or password. Please try again."
            }, 401);
        }

        if (!user.is_active) {
            return json({
                success: false,
                message: "Sorry this account has been terminated.\nPlease contact admin."
            }, 401);
        }

        const sessionId = generateSessionId();

        // 7-day session
        const expiresAt =
            Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

        await env.fullstop_db.prepare(`
            INSERT INTO sessions (id, user_id, expires_at)
            VALUES (?, ?, ?)
        `).bind(
            sessionId,
            user.id,
            expiresAt
        ).run();

        return json(
            {
                success: true,
                message: "Login successful.",
                data: safeUser(user)
            },
            200,
            {
                "Set-Cookie":
                    `fs_session=${encodeURIComponent(sessionId)}; ` +
                    `Path=/; ` +
                    `HttpOnly; ` +
                    `Secure; ` +
                    `SameSite=Lax; ` +
                    `Max-Age=${7 * 24 * 60 * 60}`
            }
        );
    }

    // ---------------------------------------------------------
    // DELETE — Logout
    // ---------------------------------------------------------
    if (method === "DELETE") {
        const sessionId = getCookie(request, "fs_session");

        if (sessionId) {
            await env.fullstop_db
                .prepare("DELETE FROM sessions WHERE id = ?")
                .bind(sessionId)
                .run();
        }

        return json(
            {
                success: true,
                message: "Logged out successfully."
            },
            200,
            {
                "Set-Cookie":
                    "fs_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
            }
        );
    }

    return json({
        success: false,
        message: "Method not allowed."
    }, 405);
}
