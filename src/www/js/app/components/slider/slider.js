/**
 * Web App - slider.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["knockout"], function(ko) {
    "use strict";

    function Slider(params) {

        const self = this;

        self.min  = params.min;
        self.max  = params.max;
        self.step = params.step;

        self.value   = params.value;

        self.style = ko.pureComputed(function() {
            const pos = (self.value() - self.min) * 100 / (self.max - self.min);
            return pos + "%";
        }, self);

    }

    return {
        viewModel: Slider,
        template: '<input type="range" data-bind="attr: { min: min, max: max, step: step }, value: value, valueUpdate: \'input\', style: { \'--pos\': style }">'
    };

});
