var d3 = require('d3'),
	_ = require('lodash');

var HEADER_HEIGHT = 44*2,
	h = window.innerHeight - HEADER_HEIGHT,
	w = +window.innerWidth,
	svg,
	timeAxis,
	timeScale,
	verticalScale,
	AXIS_HEIGHT = 35,
	zoom,
	lastActivities = [],
	color = d3.scale.category20b();

function ensureTimeScale(activities){
	var minTime = d3.min(activities, function(d){ return d.beginTime; }),
		maxTime = d3.max(activities, function(d){ return d.endTime || Date.now(); });

	if (!timeScale) timeScale = d3.time.scale();

	timeScale = timeScale
		.domain([new Date(minTime), new Date(maxTime)])
		.range([10, w-10]);

	return timeScale;
}

function setHorizontalPosition(selection){
	selection
		.attr('x', function(d){
			var x = timeScale(new Date(d.beginTime));
			return x;
		})
		.attr('width', function(d){ 
			var begin = timeScale(new Date(d.beginTime)), v;

			if (d.endTime) {
				v = timeScale(new Date(d.endTime)) - begin;
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
			var begin = timeScale(new Date(d.beginTime)), v;

			if (d.endTime) {
				v = timeScale(new Date(d.endTime)) - begin;
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


function render(activities){
	activities = activities || lastActivities;

	activities.forEach(function(activity, i){
		activity.color = activity.color || color(i);
	});

	doRender(activities);
}

var foreground, background, leftArrow, rightArrow,text;
function doRender(activities){
	h = window.innerHeight - HEADER_HEIGHT,
	w = +window.innerWidth,

	activities = _.sortBy(activities,function(a){return new Date(a.beginTime);});

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

		svg = d3.select('#timeline-container')
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



	verticalScale = d3.scale.ordinal()
		.domain(d3.range(activities.length))
		.rangeRoundBands([0,(h-AXIS_HEIGHT)], 0.05);


	var groups = svg.selectAll('g.activity')
		.data(activities, function(d){ return d._id; });

		
	groups.select('rect.background')
		.call(setVerticalPosition);
	groups.select('rect.foreground')
		.call(setVerticalPosition);

	var newGroups = groups
		.enter()
		.append('g')
		.classed('activity', true)
		.attr('data-id', function(d){ return d._id; });
	
	
	// background bar
	newGroups
		.append('rect')
		.classed('background', true)
		.attr('x', 0)
		.attr('width', w)
		.call(setVerticalPosition);

	// colored graph bar
	newGroups
		.append('rect')
		.classed('foreground', true)
		//.on('click', function(d){
			//d3.event.stopPropagation();
			//actionList.show(d.id);
		//})
		.attr('width', 0)
		.call(setVerticalPosition)
		.transition()
		.attr('fill', function(d){ return d.color;})
		.call(setHorizontalPosition);


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
		.attr('fill', function(d){ return d.color;});

	newGroups
		.append('path')
		.classed('right-arrow', true)
		.attr('d', arc)
		.attr('transform', function(d, i){ 
			var h = verticalScale(i) + (barHeight/2);
			var x = w - 20;
			return 'translate('+x+','+  h +') rotate(90)';
		})
		.attr('fill', function(d){ return d.color;});

	newGroups
		.append('text')
		.style('opacity', 0.3)
		.attr('fill', function(){ return 'black';/*d.color;*/})
		.attr('font-size', verticalScale.rangeBand()/2)
		.attr('y', function(d, i){ 
			var h = barHeight * 3/4;
			return verticalScale(i) +h ;
		})
		.text(function(d){return d.data.title || 'no title'; })
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

module.exports = render;
