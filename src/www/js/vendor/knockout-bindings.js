/**
 * Web App - knockout-bindings.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

/* global i18n */
define(["knockout", "utils", "i18n"], function(ko, ux) {
    "use strict";


    /* --- DIRTY FLAG --- */

    ko.dirtyFlag = function(data) {
        let hash = ko.observable(ko.toJSON(data));
        const fn = function() {};
        fn.isDirty = ko.computed(function() {
            return (hash() !== ko.toJSON(data));
        }).extend({ notify: "always" });
        fn.setClean = function() {
            hash(ko.toJSON(data));
        };
        fn.getDirty = function() {
            let a = JSON.parse(hash());
            let b = JSON.parse(ko.toJSON(data));
            const c = [];

            a = a.map(function(item) {
                return ko.toJSON(item);
            });

            b = b.map(function(item) {
                return ko.toJSON(item);
            });

            b.forEach(function(item) {
                if (a.indexOf(item) < 0) {
                    c.push(JSON.parse(item));
                }
            });

            return c;
        };
        fn.dispose = function() {
            fn.isDirty.dispose();
            hash = null;
        };
        return fn;
    };


    /* --- EXTENDERS --- */

    ko.extenders.numeric = function(target) {
        const interceptor = ko.pureComputed({
            read: target,
            write: function(value) {
                const oldVal = target();
                const newVal = parseInt(value) ? parseInt(value) : 0;
                if (newVal !== oldVal) {
                    target(newVal);
                }
            }
        }).extend({ notify: "always" });

        interceptor(target());
        return interceptor;
    };

    ko.extenders.decimal = function(target) {
        const interceptor = ko.pureComputed({
            read: target,
            write: function(value) {
                const oldVal = target();
                const newVal = parseFloat(value) ? parseFloat(value) : 0;
                if (newVal !== oldVal) {
                    target(newVal);
                }
            }
        }).extend({ notify: "always" });

        interceptor(target());
        return interceptor;
    };


    /* --- CUSTOM BINDINGS --- */

    ko.bindingHandlers.i18n = {
        init: function(element) {
            const el = element.firstChild;
            if (el === null) {
                element.appendChild(document.createTextNode(""));
            } else if (el.nodeType !== 3) {
                element.insertBefore(document.createTextNode(""), el);
            }
        },
        update: function(element, valueAccessor, allBindings) {
            const language = ko.language(); // just for subscription
            if (language) {
                const key = valueAccessor();
                const value = allBindings.get("value") || null;
                const translation = value ? i18n(key, ko.unwrap(value)) : i18n(key);
                const el = element.firstChild; // get the first child node (should be a text node)
                el.textContent = translation;
            } else {
                const key = valueAccessor();
                const el = element.firstChild;
                el.textContent = key;
            }
        }
    };

    ko.bindingHandlers.validate = {
        init: function(element, valueAccessor, allBindings) {
            element.addEventListener("focus", function() {
                const value = ko.unwrap(valueAccessor());
                const style = allBindings.get("style") || "";
                switch (style) {
                case "decimal":
                    element.value = typeof value === "number" ? value.toFixed(2) : "0.00";
                    break;
                case "numeric":
                    element.value = typeof value === "number" ? value : "0";
                    break;
                default:
                    element.value = value;
                }
            });
            element.addEventListener("blur", function() {
                const observable = valueAccessor();
                let value = element.value;
                const style = allBindings.get("style") || "";
                switch (style) {
                case "decimal":
                    value = parseFloat(value.replace(",", "."));
                    if (Number.isNaN(value)) {
                        element.value = "0.00";
                        observable(0.00);
                    } else {
                        value = Math.round(value*100)/100;
                        element.value = ux.formatNumber(value, 2, { numberDec: "." });
                        observable(value);
                    }
                    break;
                case "numeric":
                    value = parseInt(value);
                    if (Number.isNaN(value)) {
                        element.value = "0";
                        observable(0);
                    } else {
                        element.value = value;
                        observable(value);
                    }
                    break;
                default:
                    element.value = value;
                    observable(value);
                }
            });
        },
        update: function(element, valueAccessor, allBindings) {
            const value = ko.unwrap(valueAccessor());
            const style = allBindings.get("style") || "";
            if (typeof value === "number") {
                switch (style) {
                case "decimal":
                    element.value = ux.formatNumber(value, 2, { numberDec: "." });
                    break;
                default:
                    element.value = value;
                }
            } else {
                element.value = "";
            }
        }
    };

    ko.bindingHandlers.format = {
        update: function(element, valueAccessor, allBindings) {
            const observable = valueAccessor();
            const style = allBindings.get("style") || "";
            let value = ko.unwrap(observable);
            let formatted = "";
            if (!value) { value = 0; }
            if (style === "temperature") {
                formatted = ux.formatValue(value, 0, ko.languageFormats(), "%s° C");
            } else if (style === "percentage") {
                formatted = ux.formatValue(value*100, 0, ko.languageFormats(), "%s %");
            } else if (style === "mm/m") {
                formatted = ux.formatValue(value, 0, ko.languageFormats(), "%s mm/m");
            } else if (style === "mm") {
                formatted = ux.formatValue(value, 2, ko.languageFormats(), "%s mm");
            } else if (style === "decimal") {
                formatted = ux.formatNumber(value, 2, ko.languageFormats());
            } else {
                formatted = value;
            }
            element.textContent = formatted;
        }
    };

    ko.bindingHandlers.navLink = {
        init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
            ko.applyBindingsToNode(element, {
                click: function() {

                    const root = element.closest("[role='tablist']");
                    if (!root) { return; }

                    const viewId = ko.unwrap(valueAccessor());
                    const navStack = ko.utils.domData.get(root, "navStack") || [];

                    if (viewId !== null) {

                        const currentView = root.querySelector("[role='tabpanel']:not([hidden])");
                        if (currentView) {
                            ux.hide(currentView, "slideOutLeft");
                        }

                        navStack.push(viewId);

                        const nextView = document.getElementById(viewId);
                        if (nextView) {
                            ux.show(nextView, "slideInRight");
                        }

                        ko.utils.domData.set(root, "navStack", navStack);

                    } else {

                        const currentView = root.querySelector("[role='tabpanel']:not([hidden])");
                        if (currentView) {
                            ux.hide(currentView, "slideOutRight");
                        }

                        navStack.pop();

                        const id = navStack[navStack.length - 1];
                        const previousView = id ? document.getElementById(id) : root.querySelector("[role='tabpanel']:first-of-type");
                        if (previousView) {
                            ux.show(previousView, "slideInLeft");
                        }

                        ko.utils.domData.set(root, "navStack", navStack);
                    }
                }
            }, bindingContext);
        }
    };

    ko.bindingHandlers.navDestination = {
        update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {

            ko.virtualElements.emptyNode(element);

            const params = ko.unwrap(valueAccessor());
            if (!params) { return; }

            const data = ko.unwrap(params.for);
            if (!data) { return; }

            const componentName = ko.unwrap(params.destination);

            const pushView = function(parentNode) {

                const node = parentNode.nextElementSibling;
                if (!node) { return; }

                const root = node.closest("[role='tablist']");
                if (!root) { return; }

                const navStack = ko.utils.domData.get(root, "navStack") || [];

                const currentView = root.querySelector("[role='tabpanel']:not([hidden])");
                if (currentView) {
                    ux.hide(currentView, "slideOutLeft");
                }

                const nextView = node.closest("[role='tabpanel'][hidden]");
                if (nextView) {
                    ux.show(nextView, "slideInRight");
                    navStack.push(nextView.id);
                }

                ko.utils.domData.set(root, "navStack", navStack);
            };

            ko.applyBindingsToNode(element, {
                component: { name: componentName, params: { data: params.for } },
                descendantsComplete: pushView
            }, bindingContext);
        }
    };

    ko.virtualElements.allowedBindings.navDestination = true;

    ko.bindingHandlers.alert = {
        update: function(element, valueAccessor) {
            const isPresented = ko.unwrap(valueAccessor());
            if (isPresented === true && !element.hasAttribute("open")) {
                ux.showAlert(element);
            } else if (isPresented === false && element.hasAttribute("open")) {
                ux.hideAlert(element);
            }
        }
    };
});
