/*!
 * ClockPicker v{package.version} (http://weareoutman.github.io/clockpicker/)
 * Copyright 2014 Wang Shenwei.
 * Licensed under MIT (https://github.com/weareoutman/clockpicker/blob/gh-pages/LICENSE)
 */

;(function(){
    var $ = window.jQuery,
        $win = $(window),
        $doc = $(document),
        $body;

    // 检查浏览器是否支持内联 SVG
    var svgNS = 'http://www.w3.org/2000/svg',
        svgSupported = 'SVGAngle' in window && (function(){
            var supported,
                el = document.createElement('div');
            el.innerHTML = '<svg/>';
            supported = (el.firstChild && el.firstChild.namespaceURI) == svgNS;
            el.innerHTML = '';
            return supported;
        })();

    // 检查浏览器是否支持 CSS3 transition
    var transitionSupported = (function(){
        var style = document.createElement('div').style;
        return 'transition' in style ||
            'WebkitTransition' in style ||
            'MozTransition' in style ||
            'msTransition' in style ||
            'OTransition' in style;
    })();

    // 判断是否为触摸屏设备，决定监听触摸事件还是鼠标事件
    var touchSupported = 'ontouchstart' in window,
        mousedownEvent = 'mousedown' + ( touchSupported ? ' touchstart' : ''),
        mousemoveEvent = 'mousemove.clockpicker' + ( touchSupported ? ' touchmove.clockpicker' : ''),
        mouseupEvent = 'mouseup.clockpicker' + ( touchSupported ? ' touchend.clockpicker' : '');

    // 检查设备是否支持震动
    var vibrate = navigator.vibrate ? 'vibrate' : navigator.webkitVibrate ? 'webkitVibrate' : null;

    // 创建 SVG 元素
    function createSvgElement(name) {
        return document.createElementNS(svgNS, name);
    }

    // 补零函数，个位数前补0
    function leadingZero(num) {
        return (num < 10 ? '0' : '') + num;
    }

    // 生成唯一ID
    var idCounter = 0;
    function uniqueId(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    }

    // 表盘相关尺寸参数
    var dialRadius = 100,      // 表盘半径
        outerRadius = 80,      // 外圈半径
        innerRadius = 54,      // 内圈半径（12小时制时用）
        tickRadius = 13,       // 刻度半径
        diameter = dialRadius * 2, // 表盘直径
        duration = transitionSupported ? 350 : 1; // 动画持续时间

    // 弹出层模板
    var tpl = [
        '<div class="popover clockpicker-popover">',
            '<div class="arrow"></div>',
            '<div class="popover-title">',
                '<span class="clockpicker-span-hours text-primary"></span>',
                ' : ',
                '<span class="clockpicker-span-minutes"></span>',
                '<span class="clockpicker-span-am-pm"></span>',
            '</div>',
            '<div class="popover-content">',
                '<div class="clockpicker-plate">',
                    '<div class="clockpicker-canvas"></div>',
                    '<div class="clockpicker-dial clockpicker-hours"></div>',
                    '<div class="clockpicker-dial clockpicker-minutes clockpicker-dial-out"></div>',
                '</div>',
                '<span class="clockpicker-am-pm-block">',
                '</span>',
            '</div>',
        '</div>'
    ].join('');

    /**
     * ClockPicker 构造函数
     * @param {jQuery} element - 目标元素
     * @param {Object} options - 配置项
     */
    function ClockPicker(element, options) {
        var popover = $(tpl),
            plate = popover.find('.clockpicker-plate'),
            hoursView = popover.find('.clockpicker-hours'),
            minutesView = popover.find('.clockpicker-minutes'),
            amPmBlock = popover.find('.clockpicker-am-pm-block'),
            isInput = element.prop('tagName') === 'INPUT',
            input = isInput ? element : element.find('input'),
            addon = element.find('.input-group-addon'),
            self = this,
            timer;

        this.id = uniqueId('cp'); // 唯一ID
        this.element = element;   // 目标元素
        this.options = options;   // 配置项
        this.isAppended = false;  // 是否已添加到body
        this.isShown = false;     // 是否已显示
        this.currentView = 'hours'; // 当前视图（小时/分钟）
        this.isInput = isInput;   // 是否为input
        this.input = input;       // 输入框
        this.addon = addon;       // 输入框右侧按钮
        this.popover = popover;   // 弹出层
        this.plate = plate;       // 表盘
        this.hoursView = hoursView; // 小时视图
        this.minutesView = minutesView; // 分钟视图
        this.amPmBlock = amPmBlock; // AM/PM 按钮区域
        this.spanHours = popover.find('.clockpicker-span-hours'); // 小时显示
        this.spanMinutes = popover.find('.clockpicker-span-minutes'); // 分钟显示
        this.spanAmPm = popover.find('.clockpicker-span-am-pm'); // AM/PM 显示
        this.amOrPm = "PM"; // 默认PM

        // 12小时制时添加AM/PM按钮
        if (options.twelvehour) {
            var amPmButtonsTemplate = ['<div class="clockpicker-am-pm-block">',
                '<button type="button" class="btn btn-sm btn-default clockpicker-button clockpicker-am-button">',
                'AM</button>',
                '<button type="button" class="btn btn-sm btn-default clockpicker-button clockpicker-pm-button">',
                'PM</button>',
                '</div>'].join('');

            var amPmButtons = $(amPmButtonsTemplate);

            // 添加AM按钮点击事件
            $('<button type="button" class="btn btn-sm btn-default clockpicker-button am-button">' + "AM" + '</button>')
                .on("click", function() {
                    self.amOrPm = "AM";
                    $('.clockpicker-span-am-pm').empty().append('AM');
                }).appendTo(this.amPmBlock);

            // 添加PM按钮点击事件
            $('<button type="button" class="btn btn-sm btn-default clockpicker-button pm-button">' + "PM" + '</button>')
                .on("click", function() {
                    self.amOrPm = 'PM';
                    $('.clockpicker-span-am-pm').empty().append('PM');
                }).appendTo(this.amPmBlock);
        }

        // 非自动关闭时，添加“完成”按钮
        if (! options.autoclose) {
            $('<button type="button" class="btn btn-sm btn-default btn-block clockpicker-button">' + options.donetext + '</button>')
                .click($.proxy(this.done, this))
                .appendTo(popover);
        }

        // 修正弹出层位置和箭头对齐方式
        if ((options.placement === 'top' || options.placement === 'bottom') && (options.align === 'top' || options.align === 'bottom')) options.align = 'left';
        if ((options.placement === 'left' || options.placement === 'right') && (options.align === 'left' || options.align === 'right')) options.align = 'top';

        popover.addClass(options.placement);
        popover.addClass('clockpicker-align-' + options.align);

        // 点击小时/分钟切换视图
        this.spanHours.click($.proxy(this.toggleView, this, 'hours'));
        this.spanMinutes.click($.proxy(this.toggleView, this, 'minutes'));

        // 输入框获取焦点或点击时显示弹出层
        input.on('focus.clockpicker click.clockpicker', $.proxy(this.show, this));
        addon.on('click.clockpicker', $.proxy(this.toggle, this));

        // 构建表盘刻度
        var tickTpl = $('<div class="clockpicker-tick"></div>'),
            i, tick, radian, radius;

        // 小时视图刻度
        if (options.twelvehour) {
            for (i = 1; i < 13; i += 1) {
                tick = tickTpl.clone();
                radian = i / 6 * Math.PI;
                radius = outerRadius;
                tick.css('font-size', '120%');
                tick.css({
                    left: dialRadius + Math.sin(radian) * radius - tickRadius,
                    top: dialRadius - Math.cos(radian) * radius - tickRadius
                });
                tick.html(i === 0 ? '00' : i);
                hoursView.append(tick);
                tick.on(mousedownEvent, mousedown);
            }
        } else {
            for (i = 0; i < 24; i += 1) {
                tick = tickTpl.clone();
                radian = i / 6 * Math.PI;
                var inner = i > 0 && i < 13;
                radius = inner ? innerRadius : outerRadius;
                tick.css({
                    left: dialRadius + Math.sin(radian) * radius - tickRadius,
                    top: dialRadius - Math.cos(radian) * radius - tickRadius
                });
                if (inner) {
                    tick.css('font-size', '120%');
                }
                tick.html(i === 0 ? '00' : i);
                hoursView.append(tick);
                tick.on(mousedownEvent, mousedown);
            }
        }

        // 分钟视图刻度（每5分钟一个刻度）
        for (i = 0; i < 60; i += 5) {
            tick = tickTpl.clone();
            radian = i / 30 * Math.PI;
            tick.css({
                left: dialRadius + Math.sin(radian) * outerRadius - tickRadius,
                top: dialRadius - Math.cos(radian) * outerRadius - tickRadius
            });
            tick.css('font-size', '120%');
            tick.html(leadingZero(i));
            minutesView.append(tick);
            tick.on(mousedownEvent, mousedown);
        }

        // 点击表盘空白区域也可选中
        plate.on(mousedownEvent, function(e){
            if ($(e.target).closest('.clockpicker-tick').length === 0) {
                mousedown(e, true);
            }
        });

        /**
         * 表盘鼠标/触摸按下事件
         * @param {Event} e
         * @param {Boolean} space 是否点击空白区域
         */
        function mousedown(e, space) {
            var offset = plate.offset(),
                isTouch = /^touch/.test(e.type),
                x0 = offset.left + dialRadius,
                y0 = offset.top + dialRadius,
                dx = (isTouch ? e.originalEvent.touches[0] : e).pageX - x0,
                dy = (isTouch ? e.originalEvent.touches[0] : e).pageY - y0,
                z = Math.sqrt(dx * dx + dy * dy),
                moved = false;

            // 点击空白区域时，判断是否在有效范围
            if (space && (z < outerRadius - tickRadius || z > outerRadius + tickRadius)) {
                return;
            }
            e.preventDefault();

            // 200ms后设置body为移动状态
            var movingTimer = setTimeout(function(){
                $body.addClass('clockpicker-moving');
            }, 200);

            // 将canvas置于顶层
            if (svgSupported) {
                plate.append(self.canvas);
            }

            // 设置指针
            self.setHand(dx, dy, ! space, true);

            // 监听鼠标/触摸移动
            $doc.off(mousemoveEvent).on(mousemoveEvent, function(e){
                e.preventDefault();
                var isTouch = /^touch/.test(e.type),
                    x = (isTouch ? e.originalEvent.touches[0] : e).pageX - x0,
                    y = (isTouch ? e.originalEvent.touches[0] : e).pageY - y0;
                if (! moved && x === dx && y === dy) {
                    // Chrome下点击会触发一次mousemove，需过滤
                    return;
                }
                moved = true;
                self.setHand(x, y, false, true);
            });

            // 监听鼠标/触摸松开
            $doc.off(mouseupEvent).on(mouseupEvent, function(e){
                $doc.off(mouseupEvent);
                e.preventDefault();
                var isTouch = /^touch/.test(e.type),
                    x = (isTouch ? e.originalEvent.changedTouches[0] : e).pageX - x0,
                    y = (isTouch ? e.originalEvent.changedTouches[0] : e).pageY - y0;
                if ((space || moved) && x === dx && y === dy) {
                    self.setHand(x, y);
                }
                if (self.currentView === 'hours') {
                    self.toggleView('minutes', duration / 2);
                } else {
                    if (options.autoclose) {
                        self.minutesView.addClass('clockpicker-dial-out');
                        setTimeout(function(){
                            self.done();
                        }, duration / 2);
                    }
                }
                plate.prepend(canvas);

                // 恢复body样式
                clearTimeout(movingTimer);
                $body.removeClass('clockpicker-moving');

                // 解绑mousemove事件
                $doc.off(mousemoveEvent);
            });
        }

        // 支持SVG时，绘制表盘指针等
        if (svgSupported) {
            var canvas = popover.find('.clockpicker-canvas'),
                svg = createSvgElement('svg');
            svg.setAttribute('class', 'clockpicker-svg');
            svg.setAttribute('width', diameter);
            svg.setAttribute('height', diameter);
            var g = createSvgElement('g');
            g.setAttribute('transform', 'translate(' + dialRadius + ',' + dialRadius + ')');
            var bearing = createSvgElement('circle');
            bearing.setAttribute('class', 'clockpicker-canvas-bearing');
            bearing.setAttribute('cx', 0);
            bearing.setAttribute('cy', 0);
            bearing.setAttribute('r', 2);
            var hand = createSvgElement('line');
            hand.setAttribute('x1', 0);
            hand.setAttribute('y1', 0);
            var bg = createSvgElement('circle');
            bg.setAttribute('class', 'clockpicker-canvas-bg');
            bg.setAttribute('r', tickRadius);
            var fg = createSvgElement('circle');
            fg.setAttribute('class', 'clockpicker-canvas-fg');
            fg.setAttribute('r', 3.5);
            g.appendChild(hand);
            g.appendChild(bg);
            g.appendChild(fg);
            g.appendChild(bearing);
            svg.appendChild(g);
            canvas.append(svg);

            this.hand = hand;
            this.bg = bg;
            this.fg = fg;
            this.bearing = bearing;
            this.g = g;
            this.canvas = canvas;
        }

        // 调用初始化回调
        raiseCallback(this.options.init);
    }

    /**
     * 安全调用回调函数
     * @param {Function} callbackFunction
     */
    function raiseCallback(callbackFunction) {
        if (callbackFunction && typeof callbackFunction === "function") {
            callbackFunction();
        }
    }

    // 默认配置
    ClockPicker.DEFAULTS = {
        'default': '',
        fromnow: 0,          // 默认时间为当前时间加上毫秒数
        placement: 'bottom', // 弹出层位置
        align: 'left',       // 箭头对齐方式
        donetext: '完成',    // 完成按钮文本
        autoclose: false,    // 选择分钟后自动关闭
        twelvehour: false,   // 是否12小时制
        vibrate: true        // 拖动指针时设备震动
    };

    /**
     * 显示或隐藏弹出层
     */
    ClockPicker.prototype.toggle = function(){
        this[this.isShown ? 'hide' : 'show']();
    };

    /**
     * 定位弹出层
     */
    ClockPicker.prototype.locate = function(){
        var element = this.element,
            popover = this.popover,
            offset = element.offset(),
            width = element.outerWidth(),
            height = element.outerHeight(),
            placement = this.options.placement,
            align = this.options.align,
            styles = {},
            self = this;

        popover.show();

        // 设置弹出层位置
        switch (placement) {
            case 'bottom':
                styles.top = offset.top + height;
                break;
            case 'right':
                styles.left = offset.left + width;
                break;
            case 'top':
                styles.top = offset.top - popover.outerHeight();
                break;
            case 'left':
                styles.left = offset.left - popover.outerWidth();
                break;
        }

        // 设置箭头对齐
        switch (align) {
            case 'left':
                styles.left = offset.left;
                break;
            case 'right':
                styles.left = offset.left + width - popover.outerWidth();
                break;
            case 'top':
                styles.top = offset.top;
                break;
            case 'bottom':
                styles.top = offset.top + height - popover.outerHeight();
                break;
        }

        popover.css(styles);
    };

    /**
     * 显示弹出层
     */
    ClockPicker.prototype.show = function(e){
        // 已显示则不再显示
        if (this.isShown) {
            return;
        }

        raiseCallback(this.options.beforeShow);

        var self = this;

        // 初始化
        if (! this.isAppended) {
            // 添加到body
            $body = $(document.body).append(this.popover);

            // 窗口大小变化时重新定位
            $win.on('resize.clockpicker' + this.id, function(){
                if (self.isShown) {
                    self.locate();
                }
            });

            this.isAppended = true;
        }

        // 获取当前时间
        var value = ((this.input.prop('value') || this.options['default'] || '') + '').split(':');
        if (value[0] === 'now') {
            var now = new Date(+ new Date() + this.options.fromnow);
            value = [
                now.getHours(),
                now.getMinutes()
            ];
        }
        this.hours = + value[0] || 0;
        this.minutes = + value[1] || 0;
        this.spanHours.html(leadingZero(this.hours));
        this.spanMinutes.html(leadingZero(this.minutes));

        // 切换到小时视图
        this.toggleView('hours');

        this.locate();

        this.isShown = true;

        // 区域外点击时隐藏
        $doc.on('click.clockpicker.' + this.id + ' focusin.clockpicker.' + this.id, function(e){
            var target = $(e.target);
            if (target.closest(self.popover).length === 0 &&
                    target.closest(self.addon).length === 0 &&
                    target.closest(self.input).length === 0) {
                self.hide();
            }
        });

        // 按ESC键隐藏
        $doc.on('keyup.clockpicker.' + this.id, function(e){
            if (e.keyCode === 27) {
                self.hide();
            }
        });

        raiseCallback(this.options.afterShow);
    };

    /**
     * 隐藏弹出层
     */
    ClockPicker.prototype.hide = function(){
        raiseCallback(this.options.beforeHide);

        this.isShown = false;

        // 解绑文档事件
        $doc.off('click.clockpicker.' + this.id + ' focusin.clockpicker.' + this.id);
        $doc.off('keyup.clockpicker.' + this.id);

        this.popover.hide();

        raiseCallback(this.options.afterHide);
    };

    /**
     * 切换小时/分钟视图
     * @param {String} view 'hours' 或 'minutes'
     * @param {Number} delay 动画延迟
     */
    ClockPicker.prototype.toggleView = function(view, delay){
        var raiseAfterHourSelect = false;
        if (view === 'minutes' && $(this.hoursView).css("visibility") === "visible") {
            raiseCallback(this.options.beforeHourSelect);
            raiseAfterHourSelect = true;
        }
        var isHours = view === 'hours',
            nextView = isHours ? this.hoursView : this.minutesView,
            hideView = isHours ? this.minutesView : this.hoursView;

        this.currentView = view;

        this.spanHours.toggleClass('text-primary', isHours);
        this.spanMinutes.toggleClass('text-primary', ! isHours);

        // 视图切换动画
        hideView.addClass('clockpicker-dial-out');
        nextView.css('visibility', 'visible').removeClass('clockpicker-dial-out');

        // 重置指针
        this.resetClock(delay);

        // 动画结束后隐藏旧视图
        clearTimeout(this.toggleViewTimer);
        this.toggleViewTimer = setTimeout(function(){
            hideView.css('visibility', 'hidden');
        }, duration);

        if (raiseAfterHourSelect) {
            raiseCallback(this.options.afterHourSelect);
        }
    };

    /**
     * 重置指针位置
     * @param {Number} delay 动画延迟
     */
    ClockPicker.prototype.resetClock = function(delay){
        var view = this.currentView,
            value = this[view],
            isHours = view === 'hours',
            unit = Math.PI / (isHours ? 6 : 30),
            radian = value * unit,
            radius = isHours && value > 0 && value < 13 ? innerRadius : outerRadius,
            x = Math.sin(radian) * radius,
            y = - Math.cos(radian) * radius,
            self = this;
        if (svgSupported && delay) {
            self.canvas.addClass('clockpicker-canvas-out');
            setTimeout(function(){
                self.canvas.removeClass('clockpicker-canvas-out');
                self.setHand(x, y);
            }, delay);
        } else {
            this.setHand(x, y);
        }
    };

    /**
     * 设置指针位置
     * @param {Number} x
     * @param {Number} y
     * @param {Boolean} roundBy5 是否按5分钟取整
     * @param {Boolean} dragging 是否拖动中
     */
    ClockPicker.prototype.setHand = function(x, y, roundBy5, dragging){
        var radian = Math.atan2(x, - y),
            isHours = this.currentView === 'hours',
            unit = Math.PI / (isHours || roundBy5 ? 6 : 30),
            z = Math.sqrt(x * x + y * y),
            options = this.options,
            inner = isHours && z < (outerRadius + innerRadius) / 2,
            radius = inner ? innerRadius : outerRadius,
            value;

            if (options.twelvehour) {
                radius = outerRadius;
            }

        // 角度归一化到[0, 2PI]
        if (radian < 0) {
            radian = Math.PI * 2 + radian;
        }

        // 取整
        value = Math.round(radian / unit);

        // 取整后的弧度
        radian = value * unit;

        // 修正小时/分钟
        if (options.twelvehour) {
            if (isHours) {
                if (value === 0) {
                    value = 12;
                }
            } else {
                if (roundBy5) {
                    value *= 5;
                }
                if (value === 60) {
                    value = 0;
                }
            }
        } else {
            if (isHours) {
                if (value === 12) {
                    value = 0;
                }
                value = inner ? (value === 0 ? 12 : value) : value === 0 ? 0 : value + 12;
            } else {
                if (roundBy5) {
                    value *= 5;
                }
                if (value === 60) {
                    value = 0;
                }
            }
        }

        // 值变化时震动
        if (this[this.currentView] !== value) {
            if (vibrate && this.options.vibrate) {
                // 防止过于频繁震动
                if (! this.vibrateTimer) {
                    navigator[vibrate](10);
                    this.vibrateTimer = setTimeout($.proxy(function(){
                        this.vibrateTimer = null;
                    }, this), 100);
                }
            }
        }

        this[this.currentView] = value;
        this[isHours ? 'spanHours' : 'spanMinutes'].html(leadingZero(value));

        // 不支持SVG时，直接高亮刻度
        if (! svgSupported) {
            this[isHours ? 'hoursView' : 'minutesView'].find('.clockpicker-tick').each(function(){
                var tick = $(this);
                tick.toggleClass('active', value === + tick.html());
            });
            return;
        }

        // 拖动时将指针置于顶层，否则置底
        if (dragging || (! isHours && value % 5)) {
            this.g.insertBefore(this.hand, this.bearing);
            this.g.insertBefore(this.bg, this.fg);
            this.bg.setAttribute('class', 'clockpicker-canvas-bg clockpicker-canvas-bg-trans');
        } else {
            this.g.insertBefore(this.hand, this.bg);
            this.g.insertBefore(this.fg, this.bg);
            this.bg.setAttribute('class', 'clockpicker-canvas-bg');
        }

        // 设置SVG指针和圆点位置
        var cx = Math.sin(radian) * radius,
            cy = - Math.cos(radian) * radius;
        this.hand.setAttribute('x2', cx);
        this.hand.setAttribute('y2', cy);
        this.bg.setAttribute('cx', cx);
        this.bg.setAttribute('cy', cy);
        this.fg.setAttribute('cx', cx);
        this.fg.setAttribute('cy', cy);
    };

    /**
     * 选择完成，写入输入框
     */
    ClockPicker.prototype.done = function() {
        raiseCallback(this.options.beforeDone);
        this.hide();
        var last = this.input.prop('value'),
            value = leadingZero(this.hours) + ':' + leadingZero(this.minutes);
        if  (this.options.twelvehour) {
            value = value + this.amOrPm;
        }

        this.input.prop('value', value);
        if (value !== last) {
            this.input.triggerHandler('change');
            if (! this.isInput) {
                this.element.trigger('change');
            }
        }

        if (this.options.autoclose) {
            this.input.trigger('blur');
        }

        raiseCallback(this.options.afterDone);
    };

    /**
     * 移除 clockpicker
     */
    ClockPicker.prototype.remove = function() {
        this.element.removeData('clockpicker');
        this.input.off('focus.clockpicker click.clockpicker');
        this.addon.off('click.clockpicker');
        if (this.isShown) {
            this.hide();
        }
        if (this.isAppended) {
            $win.off('resize.clockpicker' + this.id);
            this.popover.remove();
        }
    };

    /**
     * 设置为 jQuery 插件
     */
    $.fn.clockpicker = function(option){
        var args = Array.prototype.slice.call(arguments, 1);
        return this.each(function(){
            var $this = $(this),
                data = $this.data('clockpicker');
            if (! data) { // 如果没有实例化，则创建一个新的实例
                var options = $.extend({}, ClockPicker.DEFAULTS, $this.data(), typeof option == 'object' && option);
                $this.data('clockpicker', new ClockPicker($this, options));
            } else {
                if (typeof data[option] === 'function') {
                    data[option].apply(data, args);
                }
            }
        });
    };
}());
