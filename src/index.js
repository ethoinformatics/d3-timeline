var d3 = require('d3'),
	color = d3.scale.category20b(),
	_ = require('lodash'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

var DEFAULTS = {
	getEventTimestamp: function(d){ return d.timestamp; },
	getActivityBegin: function(d){ return d.beginTime; },
	getActivityEnd: function(d){ return d.endTime; },
	getLabel: function(d){ return d.desc; },
	getColor: function(d, i){ return d.color || color(i); },
};

function Manager(list){
	var self = this;
	EventEmitter.call(self);

	self.add = function(items){
		_.flatten([items])
			.forEach(function(item){
				list.push(item);
			});

		self.emit('change');
	};
	self.remove = function(toRemove){
		self.emit('change');
	};
	self.update = function(item){

		self.emit('change');
	};
}

util.inherits(Timeline, EventEmitter);
util.inherits(Manager, EventEmitter);

function Timeline(opts){
	if (!(this instanceof Timeline)) return new Timeline(opts);
	opts = _.extend({}, DEFAULTS, opts);

	var self = this,
		activities = [],
		events = [],
		foreground,
		background,
		leftArrow,
		rightArrow,
		HEADER_HEIGHT = 44*2,
		h = opts.height || window.innerHeight - HEADER_HEIGHT,
		w = opts.width || window.innerWidth,
		svg,
		timeAxis,
		timeScale,
		verticalScale,
		AXIS_HEIGHT = 35,
		zoom,
		text;

	EventEmitter.call(self);

	self.element = window.document.createElement('div');

	self.events = new Manager(events);
	self.activities = new Manager(activities);

	self.events.on('change', render);
	self.activities.on('change', render);

	function getBeginDateTime(item){
		var val = opts.getActivityBegin(item);
		return  val instanceof Date ? val :new Date(val);
	}

	function getEndDateTime(item){
		var val = opts.getActivityEnd(item);
		return  val instanceof Date ? val :new Date(val);
	}

	function render(){
		console.log('0');
		h = window.innerHeight - HEADER_HEIGHT,
		w = +window.innerWidth,

		_.sortBy(activities, getBeginDateTime);
		timeScale = ensureTimeScale(activities);

		if (svg){
			svg.attr('width', w)
				.attr('height', h);

			svg.selectAll('rect.container')
				.attr('width', w)
				.attr('height', h);
		} else {
			zoom = d3.behavior.zoom()
				.x(timeScale)
				.scaleExtent([0.6,1000])
				.on('zoom', onZoom);

			svg = d3.select(self.element)
				.append('svg')
				.attr('width', w)
				.attr('height', h)
				.call(zoom);

			svg
				.append('rect')
				.classed('container', true)
				.style('opacity', 0)
				.attr('width', w)
				.attr('height', h);
		}

		console.log('1');
		verticalScale = d3.scale.ordinal()
			.domain(d3.range(activities.length))
			.rangeRoundBands([0,(h-AXIS_HEIGHT)], 0.05);

		var groups = svg.selectAll('g.activity')
			.data(activities);

		groups.select('rect.background')
			.call(setVerticalPosition);

		groups.select('rect.foreground')
			.call(setVerticalPosition);

		var newGroups = groups
			.enter()
			.append('g')
			.classed('activity', true)
			.attr('data-id', function(d){ return d._id; });

		console.log('2');
		// background bar
		newGroups
			.append('rect')
			.classed('background', true)
			.attr('x', 0)
			.attr('width', w)
			.style('fill', '#f8f8f8')
			.call(setVerticalPosition);

		// colored graph bar
		newGroups
			.append('rect')
			.classed('foreground', true)
			.on('click', function(d){
				d3.event.stopPropagation();
				self.emit('click', d);
			})
			.attr('width', 0)
			.call(setVerticalPosition)
			.transition()
			.attr('fill', opts.getColor)
			.call(setHorizontalPosition);

		console.log('3');
		var barHeight = verticalScale.rangeBand();
		var triangleSize = (barHeight*barHeight)/4;

		var arc = d3.svg.symbol()
			.type('triangle-up')
			.size(triangleSize);

		newGroups
			.append('path')
			.classed('left-arrow', true)
			.attr('d', arc)
			.attr('transform', function(d, i){ 
				var h = verticalScale(i) + (barHeight/2);
				return 'translate(20,' + h +') rotate(-90)';
			})
			.attr('fill', opts.getColor);

		console.log('4');
		newGroups
			.append('path')
			.classed('right-arrow', true)
			.attr('d', arc)
			.attr('transform', function(d, i){ 
				var h = verticalScale(i) + (barHeight/2);
				var x = w - 20;
				return 'translate('+x+','+  h +') rotate(90)';
			})
			.attr('fill', opts.getColor);

		newGroups
			.append('text')
			.style('opacity', 0.3)
			.attr('fill', function(){ return 'black';/*d.color;*/})
			.attr('font-size', verticalScale.rangeBand()/2)
			.attr('y', function(d, i){ 
				var h = barHeight * 3/4;
				return verticalScale(i) +h ;
			})
			.text(opts.getLabel)
			.call(setTextPosition);
		
		// activityGroups
		// 	.append('text')
		// 	.text(function(d){ return d.type; })
		// 	.attr('y', function(d, i){ return yScale(i) + yScale.rangeBand()/2; })
		// 	.attr('height', yScale.rangeBand())

		groups
			.exit()
			.transition()
			.attr('width',0)
			.attr('height',0)
			.style('opacity',0)
			.remove();

		if (!timeAxis){
			timeAxis = d3.svg.axis()
				.scale(timeScale)
				.orient('bottom');

			svg.append('g')
				.attr('class', 'time-axis')
				.attr('transform', 'translate(0, '+(h-AXIS_HEIGHT)+')')
				.call(timeAxis);

		} else {
			
			timeAxis.scale(timeScale);
			svg.select('.time-axis')
				.transition()
				.attr('transform', 'translate(0, '+(h-AXIS_HEIGHT)+')')
				.call(timeAxis);
		}

		background = svg.selectAll('g.activity rect.background');
		foreground = svg.selectAll('g.activity rect.foreground');
		leftArrow = svg.selectAll('g.activity .left-arrow');
		rightArrow = svg.selectAll('g.activity .right-arrow');
		text = svg.selectAll('g.activity text');

		setArrowVisibility();
	}

	function ensureTimeScale(activities){
		var minTime = d3.min(activities, getBeginDateTime),
			maxTime = d3.max(activities, getEndDateTime);

		maxTime = maxTime || new Date();
		minTime = minTime || (function(){ 
				var a = new Date(maxTime);
				a.setHours(a.getHours()-24);
				return a;
			})();

		console.log('min: ' + minTime);
		console.log('max: ' + maxTime);
		debugger

		if (!timeScale) timeScale = d3.time.scale();

		timeScale = timeScale
			.domain([minTime, maxTime])
			.range([10, w-10]);

		return timeScale;
	}

	function setHorizontalPosition(selection){
		selection
			.attr('x', function(d){
				var x = timeScale(getBeginDateTime(d));
				console.dir(x);
				return x;
			})
			.attr('width', function(d){ 
				var begin = timeScale(getBeginDateTime(d)), v;

				if (d.endTime) {
					v = timeScale(getEndDateTime(d)) - begin;
				} else {
					v = timeScale(new Date()) - begin;
				}

				return Math.max(v, 6);
			});

		return selection;
	}

	function setVerticalPosition(selection){
		selection
			.attr('height', verticalScale.rangeBand())
			.attr('y', function(d, i){ return verticalScale(i); });

		return selection;
	}

	function setTextPosition(selection){
		selection
			.attr('x', function(d){
				var x = timeScale(new Date(d.beginTime));
				var begin = timeScale(new Date(d.beginTime)), v;

				var txtWidth = this.getComputedTextLength();

				if (d.endTime) {
					v = timeScale(new Date(d.endTime)) - begin;
				} else {
					v = timeScale(new Date()) - begin;
				}

				v = Math.max(v, 6) + x + 10;
				v = Math.max(v, 40);

				return Math.min(v, w-(txtWidth+40));
			});
	}

	function onZoom(){
		console.log('i am zooming');
		svg.selectAll('.time-axis')
			//.transition()
			.call(timeAxis);

		foreground.call(setHorizontalPosition);
		text.call(setTextPosition);

		setArrowVisibility();
	}

	function setArrowVisibility(){
		leftArrow
			.attr('visibility', function(d){
				var begin = timeScale(getBeginDateTime(d)), v;

				if (d.endTime) {
					v = timeScale(getEndDateTime(d)) - begin;
				} else {
					v = timeScale(new Date()) - begin;
				}

				return begin+v > 0 ? 'hidden' : 'visible';
			});

		rightArrow
			.attr('visibility', function(d){
				var x = timeScale(new Date(d.beginTime));
				return x < w ? 'hidden' : 'visible';
			});
	}

	//render();
}


module.exports = Timeline;
