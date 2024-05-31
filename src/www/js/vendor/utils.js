/**
 * Web App - utils.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(function() {
    "use strict";

    /* --- animation event --- */

    // eslint-disable-next-line no-extra-boolean-cast
    const animationEvent = (!!window.WebKitAnimationEvent) ? "webkitAnimationEnd" : "animationend";


    /* --- css class handling --- */

    function hasClass(el, className) {
        return el.classList ? el.classList.contains(className) : new RegExp("\\b"+ className+"\\b").test(el.className);
    }

    function addClass(el, className, fn) {
        if (el.classList) {
            el.classList.add(className);
        } else if (!hasClass(el, className)) {
            el.className += " " + className;
        }
        if (fn && typeof fn === "function") {
            el.addEventListener(animationEvent, function callback() {
                el.removeEventListener(animationEvent, callback);
                fn.call(this);
            });
        }
    }

    function removeClass(el, className, fn) {
        if (el.classList) {
            el.classList.remove(className);
        } else {
            el.className = el.className.replace(new RegExp("\\b"+ className+"\\b", "g"), "");
        }
        if (fn && typeof fn === "function") {
            el.addEventListener(animationEvent, function callback() {
                el.removeEventListener(animationEvent, callback);
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

    function showAlert() {
        const backdrop = document.createElement("div");
        addClass(backdrop, "modal-backdrop");
        addClass(backdrop, "fadeIn");
        document.body.appendChild(backdrop);

        const el = document.querySelector("dialog[role='alert'][hidden]");
        if (el) {
            addClass(el, "slideUp", function() {
                removeClass(el, "slideUp");
            });
            el.removeAttribute("hidden");
        }
    }

    function hideAlert(fn) {
        const backdrop = document.querySelector(".modal-backdrop");
        if (backdrop) {
            removeClass(backdrop, "fadeIn");
            addClass(backdrop, "fadeOut", function() {
                document.body.removeChild(backdrop);
            });
        }

        const elms = document.querySelectorAll("dialog[role='alert']:not([hidden])");
        // eslint-disable-next-line no-cond-assign
        for (let i = 0, el; el = elms[i]; i++) {
            addClass(el, "slideDown", function() {
                this.setAttribute("hidden", "");
                removeClass(this, "slideDown");
                if (fn && typeof fn === "function") {
                    fn.call();
                }
            });
        }
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
