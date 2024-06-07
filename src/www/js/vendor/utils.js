/**
 * Web App - utils.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(function() {
    "use strict";

    /* --- css class handling --- */

    function addClass(el, className, fn) {
        el.classList.add(className);
        if (fn && typeof fn === "function") {
            el.addEventListener("animationend", function callback() {
                el.removeEventListener("animationend", callback);
                fn.call(this);
            });
        }
    }

    function removeClass(el, className, fn) {
        el.classList.remove(className);
        if (fn && typeof fn === "function") {
            el.addEventListener("animationend", function callback() {
                el.removeEventListener("animationend", callback);
                fn.call(this);
            });
        }
    }


    /* --- show/hide elements --- */

    function show(el, anim, fn) {
        const className = anim || "fadeIn";
        el.removeAttribute("hidden");
        addClass(el, className, function() {
            removeClass(el, className);
            if (fn && typeof fn === "function") {
                fn.call(el);
            }
        });
    }

    function hide(el, anim, fn) {
        const className = anim || "fadeOut";
        addClass(el, className, function() {
            el.setAttribute("hidden", "");
            removeClass(el, className);
            if (fn && typeof fn === "function") {
                fn.call(el);
            }
        });
    }


    /* --- login dialog --- */

    function showLogin() {
        const el = document.getElementById("login");
        if (el) {
            addClass(el, "fadeIn", function() {
                removeClass(el, "fadeIn");
            });
            el.removeAttribute("hidden");
        }
    }

    function shakeLogin() {
        const el = document.getElementById("login");
        if (el) {
            addClass(el, "shake", function() {
                removeClass(this, "shake");
            });
        }
    }

    function hideLogin(lock) {
        const el = document.getElementById("loginForm");
        const sp = document.getElementById("loginSpinner");
        if (lock) {
            hide(el, null, function() {
                show(sp);
            });
        } else {
            hide(sp, null, function() {
                show(el);
                setTimeout(shakeLogin, 200);
            });
        }
    }


    /* --- alert --- */

    function showAlert(el) {
        addClass(el, "showAlert", () => {
            removeClass(el, "showAlert");
        });
        el.showModal();
    }

    function hideAlert(el) {
        addClass(el, "hideAlert", () => {
            removeClass(el, "hideAlert");
            el.close();
        });
    }


    /* --- string formatting --- */

    function formatValue(value, decimals, i18n, format) {
        return format.replace("%s", formatNumber(value, decimals, i18n));
    }

    function formatNumber(value, decimals, i18n) {
        const dec = i18n ? i18n.numberDec : ".";

        function toFixedDecimals(n) {
            const k = Math.pow(10, decimals);
            return "" + (Math.round(n*k)/k).toFixed(decimals);
        }

        const s = (decimals ? toFixedDecimals(value, decimals) : "" + Math.round(value)).split(".");

        if ((s[1] || "").length < decimals) {
            s[1] = s[1] || "";
            s[1] += new Array(decimals - s[1].length + 1).join("0");
        }

        return s.join(dec);
    }


    /* --- exports --- */

    return {
        show         : show,
        hide         : hide,
        showLogin    : showLogin,
        hideLogin    : hideLogin,
        showAlert    : showAlert,
        hideAlert    : hideAlert,
        formatValue  : formatValue,
        formatNumber : formatNumber,
    };
});
