/**
 * Web App - ajax.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["auth"], function(auth) {
    "use strict";

    function get(url, success, error) {

        const authToken = auth.getToken();

        const xhr = new XMLHttpRequest();
        xhr.open("GET", "/api"+url);
        xhr.onreadystatechange = function() {
            if (xhr.readyState > 3) {
                if (xhr.status === 200) {
                    if (success && typeof success === "function") {
                        try {
                            success(JSON.parse(xhr.responseText));
                        } catch(err) {
                            success(null);
                        }
                    }
                } else if (xhr.status === 401) {
                    reset();
                } else if (error && typeof error === "function") {
                    error(xhr.responseText);
                }
            }
        };

        if (authToken) {
            xhr.setRequestHeader("Authorization", "Bearer " + authToken.replace(/^"(.*)"$/, "$1"));
        }

        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send();
    }

    function post(url, data, success, error) {

        const authToken = auth.getToken();

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api"+url);
        xhr.onreadystatechange = function() {
            if (xhr.readyState > 3) {
                if (xhr.status === 200) {
                    if (success && typeof success === "function") {
                        try {
                            success(JSON.parse(xhr.responseText));
                        } catch(err) {
                            success(null);
                        }
                    }
                } else if (xhr.status === 401) {
                    reset();
                } else if (error && typeof error === "function") {
                    error(xhr.responseText);
                }
            }
        };

        if (authToken) {
            xhr.setRequestHeader("Authorization", "Bearer " + authToken.replace(/^"(.*)"$/, "$1"));
        }

        xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(data);
    }

    function login(credentials, success, error) {

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api?q=login");
        xhr.onreadystatechange = function() {
            if (xhr.readyState > 3) {
                if (xhr.status === 200 && xhr.responseText) {
                    if (auth.isToken(xhr.responseText)) {
                        auth.setToken(xhr.responseText);
                        if (success && typeof success === "function") {
                            success();
                        }
                    } else {
                        if (error && typeof error === "function") {
                            error();
                        }
                    }
                } else {
                    if (error && typeof error === "function") {
                        error();
                    }
                }
            }
        };

        xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.send(credentials);
    }

    function reset() {
        auth.clearToken();
    }


    /* --- export --- */

    return {
        login : login,
        get   : get,
        post  : post,
    };

});
