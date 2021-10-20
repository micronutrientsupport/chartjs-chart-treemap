'use strict';

import Chart from 'chart.js';
import utils from './utils';
import squarify from './squarify';

var defaults = Chart.defaults;
var helpers = Chart.helpers;
var optionHelpers = helpers.options;
var parseFont = optionHelpers._parseFont;
var resolve = optionHelpers.resolve;
var valueOrDefault = helpers.valueOrDefault;

function rectNotEqual(r1, r2) {
	return !r1 || !r2
		|| r1.x !== r2.x
		|| r1.y !== r2.y
		|| r1.w !== r2.w
		|| r1.h !== r2.h;
}

function arrayNotEqual(a1, a2) {
	var i, n;

	if (a1.lenght !== a2.length) {
		return true;
	}

	for (i = 0, n = a1.length; i < n; ++i) {
		if (a1[i] !== a2[i]) {
			return true;
		}
	}
	return false;
}

function drawCaption(rect, font) {
	var w = rect.width || rect.w;
	var h = rect.height || rect.h;
	var min = font.lineHeight * 2;
	return w > min && h > min;
}

function buildData(dataset, mainRect, font) {
	var key = dataset.key || '';
	var tree = dataset.tree || [];
	var groups = dataset.groups || [];
	var glen = groups.length;
	var sp = (dataset.spacing || 0) + (dataset.borderWidth || 0);

	function recur(gidx, rect, parent, gs) {
		var g = groups[gidx];
		var pg = (gidx > 0) && groups[gidx - 1];
		var gdata = utils.group(tree, g, key, pg, parent);
		var gsq = squarify(gdata, rect, key, g, gidx, gs);
		var ret = gsq.slice();
		var subRect;
		if (gidx < glen - 1) {
			gsq.forEach(function(sq) {
				subRect = {x: sq.x + sp, y: sq.y + sp, w: sq.w - 2 * sp, h: sq.h - 2 * sp};

				if (drawCaption(sq, font)) {
					subRect.y += font.lineHeight;
					subRect.h -= font.lineHeight;
				}
				ret.push.apply(ret, recur(gidx + 1, subRect, sq.g, sq.s));
			});
		}
		return ret;
	}

	if (!tree.length && dataset.data.length) {
		tree = dataset.tree = dataset.data;
	}

	return glen
		? recur(0, mainRect)
		: squarify(tree, mainRect, key);
}

function parseFontOptions(options) {
	return helpers.extend(parseFont({
		fontFamily: valueOrDefault(options.fontFamily, defaults.fontFamily),
		fontSize: valueOrDefault(options.fontSize, defaults.fontSize),
		fontStyle: valueOrDefault(options.fontStyle, defaults.fontStyle),
		lineHeight: valueOrDefault(options.lineHeight, defaults.lineHeight)
	}), {
		color: resolve([options.fontColor, defaults.fontColor, defaults.global.defaultFontColor])
	});
}

var Controller = Chart.DatasetController.extend({

	dataElementType: Chart.elements.Rectangle,

	update: function(reset) {
		var me = this;
		var meta = me.getMeta();
		var dataset = me.getDataset();
		var groups = dataset.groups || (dataset.groups = []);
		var font = parseFontOptions(dataset);
		var data = meta.data || [];
		var area = me.chart.chartArea;
		var key = dataset.key || '';
		var i, ilen, mainRect;

		mainRect = {x: area.left, y: area.top, w: area.right - area.left, h: area.bottom - area.top};

		if (reset || rectNotEqual(me._rect, mainRect) || me._key !== key || arrayNotEqual(me._groups, groups)) {
			me._rect = mainRect;
			me._groups = groups.slice();
			me._key = key;
			dataset.data = buildData(dataset, mainRect, font);
			me.resyncElements();
		}

		for (i = 0, ilen = data.length; i < ilen; ++i) {
			me.updateElement(data[i], i, reset);
		}
	},

	updateElement: function(item, index, reset) {
		var me = this;
		var datasetIndex = me.index;
		var dataset = me.getDataset();
		var sq = dataset.data[index];
		var options = me._resolveElementOptions(item, index);
		var h = reset ? 0 : sq.h - options.spacing * 2;
		var w = reset ? 0 : sq.w - options.spacing * 2;
		var x = sq.x + w / 2 + options.spacing;
		var y = sq.y + h / 2 + options.spacing;
		var halfH = h / 2;

		item._options = options;
		item._datasetIndex = datasetIndex;
		item._index = index;
		item.hidden = h <= options.spacing || w <= options.spacing;

		item._model = {
			x: x,
			base: y - halfH,
			y: y + halfH,
			top: sq.y,
			left: sq.x,
			width: w,
			height: h,
			backgroundColor: options.backgroundColor,
			borderColor: options.borderColor,
			borderSkipped: options.borderSkipped,
			borderWidth: options.borderWidth,
			font: parseFont(options),
			fontColor: options.fontColor
		};

		item.pivot();
	},

	draw: function() {
		var me = this;
		var metadata = me.getMeta().data || [];
		var dataset = me.getDataset();
		var levels = (dataset.groups || []).length - 1;
		var data = dataset.data || [];
		var ctx = me.chart.ctx;
		var i, ilen, rect, item, vm;

		for (i = 0, ilen = metadata.length; i < ilen; ++i) {
			rect = metadata[i];
			vm = rect._view;
			item = data[i];
			if (!rect.hidden) {
				rect.draw();
				if (drawCaption(vm, vm.font) && item.g) {
					ctx.save();
					ctx.fillStyle = vm.fontColor;
					ctx.font = vm.font.string;
					ctx.beginPath();
					ctx.rect(vm.left, vm.top, vm.width, vm.height);
					ctx.clip();
					if (!('l' in item) || item.l === levels) {
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						if(item.g.length < (vm.width / 6)) {
							ctx.fillText(item.g, vm.left + vm.width / 2, vm.top + vm.height / 2);
						}
						else {
							let string = splitString(item.g, vm.width/6);
							let fs = vm.font.size;
							let flh = vm.font.lineHeight;
							let fss = vm.font.string;
							let relWidth = (vm.width / vm.font.size);
							if (relWidth < vm.font.size && relWidth < 5) {
								vm.font.size = Math.ceil(relWidth)*1.75;
								vm.font.lineHeight = (Math.ceil(relWidth)*1.75)*1.5
								vm.font.string = `${vm.font.style} ${vm.font.size}px ${vm.font.family}`;
								ctx.font = vm.font.string;
							}
							let spread = string.length / 2 - .5;
							let pos = -spread;
							string.forEach((line, i) => {
								ctx.fillText(line, vm.left + vm.width / 2, vm.top + vm.height / 2 + (vm.font.lineHeight*pos));
								pos++;
							})

							vm.font.size = fs;
							vm.font.lineHeight = flh;
							vm.font.string = fss;
						}
					} else {
						ctx.textAlign = 'start';
						ctx.textBaseline = 'top';
						ctx.fillText(item.g, vm.left + vm.borderWidth + 3, vm.top + vm.borderWidth + 3);
					}
					ctx.restore();
				}
			}
		}
	},

	/**
	 * @private
	 */
	_resolveElementOptions: function(rectangle, index) {
		var me = this;
		var chart = me.chart;
		var dataset = me.getDataset();
		var options = chart.options.elements.rectangle;
		var values = {};
		var i, ilen, key;

		// Scriptable options
		var context = {
			chart: chart,
			dataIndex: index,
			dataset: dataset,
			datasetIndex: me.index
		};

		var keys = [
			'backgroundColor',
			'borderColor',
			'borderSkipped',
			'borderWidth',
			'fontColor',
			'fontFamily',
			'fontSize',
			'fontStyle',
			'spacing'
		];

		for (i = 0, ilen = keys.length; i < ilen; ++i) {
			key = keys[i];
			values[key] = resolve([
				dataset[key],
				options[key]
			], context, index);
		}

		return values;
	}

});

export default Controller;
