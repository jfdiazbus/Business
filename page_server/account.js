// account.js — the small amount of code behind sign in, registration, the
// account page, and saving a checkout to the account once Stripe returns.
//
// Every page works without it: the forms simply do nothing, and the server
// still cleans up after itself. There is no framework here on purpose.

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof File ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function setStatus(node, message, kind = "") {
  if (!node) return;
  node.textContent = message;
  node.className = `blog-status${kind ? ` blog-status--${kind}` : ""}`;
}

function nextPage() {
  const next = new URLSearchParams(location.search).get("next");
  if (!next) return "/account";

  try {
    const target = new URL(next, location.origin);
    if (target.origin !== location.origin) return "/account";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/account";
  }
}

function withBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

// --- sign in --------------------------------------------------------------

const loginForm = $("#login-form");
if (loginForm) {
  const status = $("#login-status");
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;
    if (!email || !password) {
      setStatus(status, "Enter your email and password.", "error");
      return;
    }
    setStatus(status, "Signing in…");
    withBusy(loginForm, true, "Signing in…");
    try {
      await api("/api/account/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      location.href = nextPage();
    } catch (cause) {
      setStatus(status, cause.message, "error");
      withBusy(loginForm, false);
    }
  });
}

// --- register -------------------------------------------------------------

const registerForm = $("#register-form");
if (registerForm) {
  const status = $("#register-status");
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = registerForm.elements.name.value.trim();
    const email = registerForm.elements.email.value.trim();
    const password = registerForm.elements.password.value;
    if (!email || !password) {
      setStatus(status, "Enter an email and a password.", "error");
      return;
    }
    if (password.length < 10) {
      setStatus(status, "Use at least 10 characters for the password.", "error");
      return;
    }
    setStatus(status, "Creating your account…");
    withBusy(registerForm, true, "Creating…");
    try {
      await api("/api/account/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      location.href = nextPage();
    } catch (cause) {
      setStatus(status, cause.message, "error");
      withBusy(registerForm, false);
    }
  });
}

// --- the account page -----------------------------------------------------

const signedOut = $("#account-signed-out");
const signedIn = $("#account-signed-in");
const loading = $("#account-loading");

function money(cents, currency) {
  const value = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: String(currency || "eur").toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${String(currency || "eur").toUpperCase()}`;
  }
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date);
}

function renderOrders(orders) {
  const list = $("#account-orders");
  if (!list) return;
  list.replaceChildren();

  if (!orders || orders.length === 0) {
    const empty = document.createElement("p");
    empty.className = "blog-muted";
    empty.textContent = "No orders yet. Buy a service while signed in and it appears here.";
    const link = document.createElement("a");
    link.href = "/services";
    link.textContent = "See the services";
    const more = document.createElement("p");
    more.className = "more";
    more.append(link);
    list.append(empty, more);
    return;
  }

  for (const order of orders) {
    const card = document.createElement("article");
    card.className = "account-order";

    const when = document.createElement("p");
    when.className = "blog-date";
    when.textContent = dateLabel(order.created_at);

    const title = document.createElement("h3");
    title.textContent = order.offer || "Service";

    const paid = document.createElement("p");
    paid.className = "account-order-meta";
    const state = order.payment_status === "paid" ? "Paid" : order.payment_status || "Pending";
    paid.textContent = `${money(order.amount_total, order.currency)} · ${state}`;

    card.append(when, title, paid);
    list.append(card);
  }
}

async function loadAccount() {
  if (!signedIn) return;
  try {
    const session = await api("/api/account/session");
    if (!session.authenticated) {
      if (loading) loading.hidden = true;
      if (signedOut) signedOut.hidden = false;
      return;
    }

    const user = session.user || {};
    const who = $("#account-who");
    if (who) {
      who.textContent = user.name
        ? `Signed in as ${user.name} (${user.email}).`
        : `Signed in as ${user.email}.`;
    }
    if (loading) loading.hidden = true;
    signedIn.hidden = false;

    const { orders } = await api("/api/account/orders");
    renderOrders(orders);
  } catch {
    if (loading) loading.hidden = true;
    if (signedOut) signedOut.hidden = false;
  }
}

if (signedIn) {
  loadAccount();

  const logout = $("#logout-button");
  if (logout) {
    logout.addEventListener("click", async () => {
      setStatus($("#account-status"), "Signing out…");
      try {
        await api("/api/account/logout", { method: "POST", body: "{}" });
        location.href = "/";
      } catch (cause) {
        setStatus($("#account-status"), cause.message, "error");
      }
    });
  }

  const passwordForm = $("#password-form");
  if (passwordForm) {
    const status = $("#password-status");
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentPassword = passwordForm.elements.currentPassword.value;
      const newPassword = passwordForm.elements.newPassword.value;
      if (newPassword.length < 10) {
        setStatus(status, "Use at least 10 characters for the new password.", "error");
        return;
      }
      setStatus(status, "Changing your password…");
      withBusy(passwordForm, true, "Changing…");
      try {
        await api("/api/account/password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        passwordForm.reset();
        setStatus(status, "Password changed. Other devices were signed out.", "success");
      } catch (cause) {
        setStatus(status, cause.message, "error");
      } finally {
        withBusy(passwordForm, false);
      }
    });
  }

  const deleteForm = $("#delete-form");
  if (deleteForm) {
    const status = $("#delete-status");
    deleteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = deleteForm.elements.password.value;
      if (!confirm("Delete your account? Your comments go too, and this cannot be undone.")) {
        return;
      }
      setStatus(status, "Deleting your account…");
      withBusy(deleteForm, true, "Deleting…");
      try {
        await api("/api/account", {
          method: "DELETE",
          body: JSON.stringify({ password }),
        });
        location.href = "/";
      } catch (cause) {
        setStatus(status, cause.message, "error");
        withBusy(deleteForm, false);
      }
    });
  }
}

// --- a checkout that has just finished ------------------------------------

const thanksNote = $("#thanks-account");
if (thanksNote) {
  const sessionId = new URLSearchParams(location.search).get("session_id");
  if (sessionId) {
    (async () => {
      try {
        const session = await api("/api/account/session");
        if (!session.authenticated) {
          thanksNote.textContent = "Sign in to keep this order with your account.";
          return;
        }
        await api("/api/account/orders/reconcile", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        setStatus(thanksNote, "This order is now in your account.", "success");
      } catch {
        // Stripe's receipt is still the record; leave the page as it is.
      }
    })();
  }
}
