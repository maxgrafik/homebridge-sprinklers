/**
 * Web App - main.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

require.config({
    baseUrl: "js/vendor",
    paths: {
        knockout   : "knockout-3.5.1",
        app        : "../app",
        components : "../app/components",
    }
});

require(["domReady!", "ajax", "utils"], function(doc, ajax, ux) {
    "use strict";

    ajax.login(null, init, login);

    function login() {
        document.getElementById("loginForm").onsubmit = function(event) {

            event.preventDefault();
            document.activeElement.blur();

            ux.hideLogin(true);

            const pass = document.getElementById("inputPass").value;
            const credentials = JSON.stringify({pass: pass});

            ajax.login(credentials, init, function() {
                ux.hideLogin(false);
            });
        };

        ux.showLogin();
    }

    function init() {
        const dlg = document.getElementById("login");
        dlg.parentNode.removeChild(dlg);

        require(["knockout", "knockout-bindings"], function(ko) {
            ko.components.register("app", { require: "app/app" });
            ko.applyBindings();
            ux.show(document.querySelector("main"));
        });
    }
});
