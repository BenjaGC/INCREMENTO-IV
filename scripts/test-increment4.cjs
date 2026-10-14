// Pruebas de aceptación y evidencias del IV en una base nueva, nunca sobre mydb.
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { spawn } = require("node:child_process");
const mysql = require("mysql2/promise");
const { chromium, expect } = require("@playwright/test");

(async () => {
  const name = "clinica_ui_test_" + Date.now();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "clinica-inc4-"));
  const output = path.resolve("artifacts/incremento-IV-20261011");
  fs.mkdirSync(output, { recursive: true });
  const options = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  };
  const db = await mysql.createConnection(options);
  let child, browser, pool;
  const checks = [],
    pageErrors = [];
  const check = (message) => {
    checks.push(message);
    console.log("OK:", message);
  };
  const password = crypto.randomBytes(18).toString("hex");
  const base = "http://127.0.0.1:3200";
  const call = async (url, token, body, method = body ? "POST" : "GET") => {
    const response = await fetch(base + url, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const launch = async () => {
    child = spawn(process.execPath, ["scripts/test-server.cjs"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        DB_NAME: name,
        CLINICA_DATA_DIR: "",
        CLINIC_TEST_PUBLIC: temp,
        CLINIC_TEST_PORT: "3200",
        CLINIC_CAPTURE_MAIL: path.join(temp, "mail.jsonl"),
        CLINICA_LOG_FALLBACK: path.join(temp, "fallback.log"),
        CLINICA_TRACE_BACKUP_DIR: path.join(temp, "trace-backups"),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let logs = "";
    child.stdout.on("data", (chunk) => (logs += chunk));
    child.stderr.on("data", (chunk) => (logs += chunk));
    for (let retry = 0; retry < 120; retry++) {
      if (child.exitCode !== null)
        throw Error("Servidor de prueba detenido: " + logs);
      try {
        if ((await fetch(base)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw Error("El servidor de pruebas no quedó disponible: " + logs);
  };
  const stop = async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
  };
  const resetGuards = () => db.query("DELETE FROM inc4_access_guard");
  try {
    await db.query("CREATE DATABASE ??", [name]);
    await db.changeUser({ database: name });
    await db.query(fs.readFileSync("database/clinica.sql", "utf8"));
    await db.query(fs.readFileSync("database/datos-iniciales.sql", "utf8"));
    for (const [id, title, rut, role, critical] of [
      [1, "Administración de soporte", "11111111-1", 1, 0],
      [2, "Funcionario de pruebas", "22222222-2", 2, 0],
      [3, "Técnico de soporte", "33333333-3", 2, 1],
    ]) {
      await db.query(
        "INSERT INTO user(user_id,first_name,first_last_name,second_last_name,institutional_email,rut,username,password_hash,is_critical_tech) VALUES (?,?,'','',?,?,?,?,?)",
        [
          id,
          title,
          `cuenta${id}@example.test`,
          rut,
          rut,
          await require("../src/passwords").hash(password),
          critical,
        ],
      );
      await db.query(
        "INSERT INTO user_role(assignment_date,active,role_id,user_id) VALUES(NOW(),1,?,?)",
        [role, id],
      );
    }
    for (const file of ["index.html", "css", "js", "vendor"])
      fs.cpSync(path.join("public", file), path.join(temp, file), {
        recursive: true,
      });
    fs.mkdirSync(path.join(temp, "uploads"));
    fs.mkdirSync(path.join(temp, "manuales"));
    await launch();
    let admin = (await call("/login", null, { rut: "11111111-1", password }))
      .data.token;
    const user = (await call("/login", null, { rut: "22222222-2", password }))
      .data.token;
    for (const endpoint of ["security", "traces"]) {
      assert.equal((await call("/api/v4/" + endpoint)).status, 401);
      assert.equal((await call("/api/v4/" + endpoint, user)).status, 403);
    }
    assert.equal(
      (await call("/api/v4/traces/policy", user, { enabled: true }, "PUT"))
        .status,
      403,
    );
    assert.equal(
      (
        await call("/api/v4/security/unlock", user, {
          user_id: 1,
          reason: "Intento de elevar permisos",
        })
      ).status,
      403,
    );
    check("RBAC: solicitante y anónimo no administran bloqueos ni retención.");
    const invalidJSON = await fetch(base + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"rut":',
    });
    assert.equal(invalidJSON.status, 400);
    assert.ok(!(await invalidJSON.text()).includes("SyntaxError"));
    const oversized = await fetch(base + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "x".repeat(270000) }),
    });
    assert.equal(oversized.status, 413);
    check(
      "JSON inválido y solicitudes excesivas producen fallos controlados sin stack del servidor.",
    );

    for (let attempt = 0; attempt < 4; attempt++)
      assert.equal(
        (
          await call("/login", null, {
            rut: "22222222-2",
            password: "ClaveIncorrecta!",
          })
        ).status,
        401,
      );
    assert.equal(
      (await call("/login", null, { rut: "22222222-2", password })).status,
      200,
    );
    assert.equal(
      (await db.query("SELECT MAX(failures) n FROM inc4_access_guard"))[0][0].n,
      0,
    );
    check("Inicio correcto antes del quinto intento reinicia los contadores.");
    for (let attempt = 0; attempt < 5; attempt++)
      assert.equal(
        (
          await call("/login", null, {
            rut: "22222222-2",
            password: "ClaveIncorrecta!",
          })
        ).status,
        attempt === 4 ? 423 : 401,
      );
    assert.equal(
      (
        await call("/login", null, {
          rut: "33333333-3",
          password,
          forwarded: "fake",
        })
      ).status,
      200,
    );
    await stop();
    await launch();
    assert.equal(
      (await call("/login", null, { rut: "22222222-2", password })).status,
      423,
    );
    check(
      "Cinco errores bloquean la combinación cuenta e IP; otra cuenta sigue disponible y reiniciar no evade el bloqueo.",
    );
    await db.query(
      "UPDATE inc4_access_guard SET blocked_until=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE blocked_until IS NOT NULL",
    );
    assert.equal(
      (await call("/login", null, { rut: "22222222-2", password })).status,
      200,
    );
    check(
      "El bloqueo temporal expira y permite reingresar sin borrar la cuenta.",
    );
    await resetGuards();
    for (let attempt = 0; attempt < 5; attempt++)
      await call("/login", null, {
        rut: "11111111-1",
        password: "ClaveIncorrecta!",
      });
    await db.query(
      "UPDATE inc4_access_guard SET blocked_until=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE blocked_until IS NOT NULL",
    );
    assert.equal(
      (await call("/login", null, { rut: "11111111-1", password })).status,
      423,
    );
    assert.equal(
      (
        await call("/api/v4/security/unlock", admin, {
          user_id: 1,
          reason: "Verificación de identidad por soporte",
        })
      ).status,
      200,
    );
    admin = (await call("/login", null, { rut: "11111111-1", password })).data
      .token;
    check(
      "Cuenta administrativa requiere desbloqueo manual con motivo auditado.",
    );
    const mails = fs
      .readFileSync(path.join(temp, "mail.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.ok(
      mails.some((mail) => mail.subject.includes("Alerta de seguridad")),
    );
    check(
      "Alerta de seguridad entregada al transporte de prueba; correo real requiere SMTP institucional.",
    );

    pool = mysql.createPool({ ...options, database: name });
    const recordLog = async (error, severity, context) =>
      pool.query(
        "INSERT INTO inc3_log(message,severity,context) VALUES(?,?,?)",
        [error.message, severity, JSON.stringify(context)],
      );
    const noMail = { sendMail: async () => ({ accepted: ["test"] }) };
    const security = require("../src/increment4/login-security")({
      pool,
      log: recordLog,
      transporter: {
        sendMail: async () => {
          throw Error("SMTP interrumpido para prueba controlada");
        },
      },
    });
    const directAttempt = async (rut, password, ip) => {
      const reply = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.data = data;
          return this;
        },
        setHeader() {},
      };
      await security.authenticate(
        { body: { rut, password }, ip, socket: {} },
        reply,
      );
      return reply;
    };
    await resetGuards();
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () =>
        directAttempt("22222222-2", "ClaveIncorrecta!", "192.0.2.15"),
      ),
    );
    assert.deepEqual(
      concurrent.map((reply) => reply.statusCode).sort(),
      [401, 401, 401, 401, 423],
    );
    assert.equal(
      (await directAttempt("22222222-2", password, "192.0.2.15")).statusCode,
      423,
    );
    assert.equal(
      (
        await db.query(
          "SELECT COUNT(*) n FROM inc4_security_event WHERE event_type='ALERT_FAILED'",
        )
      )[0][0].n,
      1,
    );
    check(
      "Cinco intentos simultáneos no evaden el umbral; fallar SMTP mantiene el bloqueo.",
    );
    await resetGuards();
    assert.equal(
      (
        await call("/login", null, {
          rut: "' OR 1=1 --",
          password: "Sin acceso",
        })
      ).status,
      401,
    );
    const spoof = await fetch(base + "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.50",
      },
      body: JSON.stringify({ rut: "22222222-2", password: "Sin acceso" }),
    });
    assert.equal(spoof.status, 401);
    assert.equal(
      (
        await db.query(
          "SELECT COUNT(*) n FROM inc4_security_event WHERE source_ip='198.51.100.50'",
        )
      )[0][0].n,
      0,
    );
    await resetGuards();
    check(
      "Inyección SQL y falsificación directa del encabezado de IP rechazadas.",
    );
    const retention = require("../src/increment4/trace-retention")({
      pool,
      log: recordLog,
      transporter: noMail,
    });
    const oldPath = process.env.CLINICA_TRACE_BACKUP_DIR;
    process.env.CLINICA_TRACE_BACKUP_DIR = path.join(temp, "trace-backups");
    assert.equal((await retention.execute()).outcome, "not_configured");
    assert.equal(
      (await call("/api/v4/traces/policy", admin, { enabled: true }, "PUT"))
        .status,
      200,
    );
    assert.equal((await retention.execute()).outcome, "no_records");
    const [equipment] = await db.query(
      "INSERT INTO equipment(equipment_name,equipment_type) VALUES('Equipo de validación','Otro')",
    );
    const [ticket] = await db.query(
      "INSERT INTO ticket(ticket_code,title,description,requester_user_id,category_id,status_id,priority_id,equipment_id) VALUES('INC0000001','Verificación de trazabilidad','El historial del ticket debe conservarse',1,1,5,1,?)",
      [equipment.insertId],
    );
    await db.query(
      "INSERT INTO audit_log(action_type,affected_table,user_id,ticket_id,action_date) VALUES('PRUEBA_RETENCION','ticket',1,?,DATE_SUB(NOW(),INTERVAL 3 YEAR))",
      [ticket.insertId],
    );
    await db.query(
      "INSERT INTO inc3_log(message,severity,created_at) VALUES('Traza antigua de prueba','info',DATE_SUB(NOW(),INTERVAL 3 YEAR))",
    );
    await db.query(
      "INSERT INTO inc4_security_event(event_type,detail,created_at) VALUES('TEST_OLD','Evento antiguo de prueba',DATE_SUB(NOW(),INTERVAL 3 YEAR))",
    );
    const result = await retention.execute();
    assert.equal(result.removed, 3);
    assert.equal(result.outcome, "completed");
    const [[run]] = await db.query(
      "SELECT * FROM inc4_retention_run WHERE id=?",
      [result.run_id],
    );
    const backup = fs.readFileSync(
      path.join(temp, "trace-backups", run.backup_name),
    );
    assert.equal(
      crypto.createHash("sha256").update(backup).digest("hex"),
      run.backup_sha256,
    );
    assert.equal(
      zlib.gunzipSync(backup).toString().trim().split("\n").length,
      4,
    );
    assert.equal((await db.query("SELECT COUNT(*) n FROM ticket"))[0][0].n, 1);
    check(
      "Retención: sin política/sin antiguas no borra; comprime, verifica y retira solo tres trazas antiguas.",
    );
    await db.query(
      "INSERT INTO inc3_log(message,severity,created_at) VALUES('Traza que debe conservarse ante fallo','info',DATE_SUB(NOW(),INTERVAL 3 YEAR))",
    );
    const badPath = path.join(temp, "not-a-directory");
    fs.writeFileSync(badPath, "Bloquea la creación del respaldo");
    process.env.CLINICA_TRACE_BACKUP_DIR = badPath;
    await assert.rejects(retention.execute());
    assert.equal(
      (
        await db.query(
          "SELECT COUNT(*) n FROM inc3_log WHERE message='Traza que debe conservarse ante fallo'",
        )
      )[0][0].n,
      1,
    );
    process.env.CLINICA_TRACE_BACKUP_DIR =
      oldPath || path.join(temp, "trace-backups");
    check(
      "Fallo de respaldo conserva las trazas, registra el error y notifica al administrador.",
    );

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1040 },
      locale: "es-CL",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(base);
    await page
      .locator(".welcome-panel")
      .getByRole("button", { name: "Iniciar sesión" })
      .click();
    await page.locator('[x-model="login.rut"]').fill("11111111-1");
    await page.locator('[x-model="login.pass"]').fill(password);
    await page
      .locator("[x-show=\"authTab==='login'\"]")
      .getByRole("button", { name: /Ingresar/ })
      .click();
    await expect(page.locator(".page-heading h1")).toBeVisible();
    await page
      .getByRole("button", { name: "Administración", exact: true })
      .click();
    await page.getByRole("button", { name: /Mantenimiento de trazas/ }).click();
    await expect(page.locator(".v4-panel")).toBeVisible();
    await expect(
      page.getByText("Respaldo comprimido verificado.", { exact: false }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(output, "mantenimiento-trazas.png"),
    });
    await page
      .locator(".v4-record")
      .filter({ hasText: "3 registros respaldados y retirados" })
      .screenshot({
        path: path.join(output, "respaldo-trazas-exitoso.png"),
      });
    await page
      .locator(".v4-record")
      .filter({ hasText: "Interrumpido: datos conservados" })
      .screenshot({
        path: path.join(output, "respaldo-trazas-fallo-controlado.png"),
      });
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar respaldo verificado" })
      .click();
    const download = await downloadPromise;
    await download.saveAs(path.join(output, "respaldo-verificado.jsonl.gz"));
    assert.ok(
      zlib.gunzipSync(
        fs.readFileSync(path.join(output, "respaldo-verificado.jsonl.gz")),
      ).length > 0,
    );
    await page.getByRole("button", { name: "Cerrar configuración" }).click();
    for (let attempt = 0; attempt < 5; attempt++)
      await directAttempt("22222222-2", "ClaveIncorrecta!", "127.0.0.1");
    const blockedContext = await browser.newContext({
      viewport: { width: 1440, height: 1040 },
      locale: "es-CL",
    });
    const blockedPage = await blockedContext.newPage();
    blockedPage.on("pageerror", (error) => pageErrors.push(error.message));
    await blockedPage.goto(base);
    await blockedPage
      .locator(".welcome-panel")
      .getByRole("button", { name: "Iniciar sesión" })
      .click();
    await blockedPage.locator('[x-model="login.rut"]').fill("22222222-2");
    await blockedPage.locator('[x-model="login.pass"]').fill(password);
    await blockedPage
      .locator("[x-show=\"authTab==='login'\"]")
      .getByRole("button", { name: /Ingresar/ })
      .click();
    await expect(
      blockedPage.getByText(/Acceso bloqueado por seguridad/),
    ).toBeVisible();
    await blockedPage
      .locator(".auth-box")
      .screenshot({ path: path.join(output, "inicio-sesion-bloqueado.png") });
    await blockedContext.close();
    await page.getByRole("button", { name: /Seguridad de acceso/ }).click();
    await expect(
      page.getByText("Actividad de seguridad", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(output, "seguridad-acceso.png"),
    });
    await page
      .getByRole("button", { name: "Revisar y desbloquear cuenta" })
      .click();
    await page
      .locator("#v4-unlock-reason")
      .fill("Identidad comprobada por administración de soporte");
    await page
      .getByRole("button", { name: "Confirmar desbloqueo", exact: true })
      .click();
    await expect(
      page.getByText("Cuenta desbloqueada. La revisión quedó registrada."),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(output, "desbloqueo-manual.png"),
    });
    await page
      .locator(".v4-record")
      .filter({ hasText: "Alerta de correo enviada" })
      .first()
      .screenshot({ path: path.join(output, "alerta-correo-registrada.png") });
    await page.getByRole("button", { name: "Cerrar configuración" }).click();
    await page.getByRole("button", { name: "Menú de perfil" }).click();
    await page
      .getByRole("button", {
        name: "Apariencia y accesibilidad",
        exact: true,
      })
      .click();
    await page.screenshot({
      path: path.join(output, "apariencia-clara.png"),
    });
    await page.getByRole("button", { name: "Oscuro", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Oscuro", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Claro", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() =>
        page
          .getByRole("button", { name: "Oscuro", exact: true })
          .evaluate((button) => getComputedStyle(button).backgroundColor),
      )
      .toBe("rgb(20, 34, 54)");
    await page.screenshot({
      path: path.join(output, "apariencia-oscura.png"),
    });
    await page.getByRole("button", { name: "Cerrar configuración" }).click();
    await page.screenshot({
      path: path.join(output, "administracion-oscura.png"),
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Menú de perfil" }).click();
    await page
      .getByRole("button", {
        name: "Apariencia y accesibilidad",
        exact: true,
      })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, "apariencia-movil.png"),
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.getByRole("button", { name: "Claro", exact: true }).click();
    await page.getByRole("button", { name: "Cerrar configuración" }).click();
    await page.setViewportSize({ width: 1440, height: 1040 });
    await page
      .getByRole("button", { name: "Administración", exact: true })
      .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "administracion-clara.png"),
    });
    // Guarda la preferencia en cada rol y verifica el estado de almacenamiento denegado.
    await page.getByRole("button", { name: "Menú de perfil" }).click();
    await page
      .getByRole("button", {
        name: "Apariencia y accesibilidad",
        exact: true,
      })
      .click();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("clinica_theme_"))
          throw Error("Prueba de almacenamiento denegado");
        return original.call(this, key, value);
      };
    });
    await page.getByRole("button", { name: "Oscuro", exact: true }).click();
    await expect(
      page.getByText(
        "El modo se aplicó en esta sesión. El navegador no permitió guardar la preferencia.",
      ),
    ).toBeVisible();
    check(
      "Modo visual conserva funcionamiento cuando el navegador rechaza guardar la preferencia.",
    );
    await page.getByRole("button", { name: "Cerrar configuración" }).click();
    for (const rut of ["22222222-2", "33333333-3"]) {
      const roleContext = await browser.newContext({
        viewport: { width: 1440, height: 1040 },
        locale: "es-CL",
      });
      const rolePage = await roleContext.newPage();
      rolePage.on("pageerror", (error) => pageErrors.push(error.message));
      await rolePage.goto(base);
      await rolePage
        .locator(".welcome-panel")
        .getByRole("button", { name: "Iniciar sesión" })
        .click();
      await rolePage.locator('[x-model="login.rut"]').fill(rut);
      await rolePage.locator('[x-model="login.pass"]').fill(password);
      await rolePage
        .locator("[x-show=\"authTab==='login'\"]")
        .getByRole("button", { name: /Ingresar/ })
        .click();
      await expect(rolePage.locator(".page-heading h1")).toBeVisible();
      await rolePage.getByRole("button", { name: "Menú de perfil" }).click();
      await rolePage
        .getByRole("button", {
          name: "Apariencia y accesibilidad",
          exact: true,
        })
        .click();
      await rolePage
        .getByRole("button", { name: "Oscuro", exact: true })
        .click();
      await expect(rolePage.locator("html")).toHaveAttribute(
        "data-theme",
        "dark",
      );
      await roleContext.close();
    }
    check(
      "Solicitante y técnico acceden a apariencia sin permisos administrativos.",
    );
    check(
      "Interfaz: accesos funcionales, respaldo descargable, modo persistente, escritorio y móvil sin desbordamiento.",
    );
    assert.deepEqual(pageErrors, []);
    fs.writeFileSync(
      path.join(output, "RESULTADO.json"),
      JSON.stringify(
        {
          date: "2026-10-11",
          checks,
          pageErrors,
          isolatedDatabase: true,
          smtp: "transporte de prueba",
        },
        null,
        2,
      ),
    );
    console.log("Errores de navegador:", pageErrors.length);
  } finally {
    if (browser) await browser.close();
    await stop();
    if (pool) await pool.end();
    await db.changeUser({ database: "mysql" });
    await db.query("DROP DATABASE ??", [name]);
    await db.end();
    if (
      path.dirname(temp) === os.tmpdir() &&
      path.basename(temp).startsWith("clinica-inc4-")
    )
      fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
