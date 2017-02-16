/*
 * 
 * @Description: mapbox 测距插件
 * @Author: charlotte.wangchao 
 * @Date: 2017-02-16 13:42:45 
 * @Last Modified by: charlotte.wangchao
 * @Last Modified time: 2017-02-16 17:48:30
 */


function MeasureControl(options) {
    this.options = Object.assign({},  MeasureControl.DEFAULTS, options);
    this._onClick = this._onClick.bind(this);
    this._onDblClick = this._onDblClick.bind(this);
    this._onMousemove = this._onMousemove.bind(this);
    this._onAddSourceLayer = this._onAddSourceLayer.bind(this);
    this._toggleState = this._toggleState.bind(this);
    this._onAddMouseTips = this._onAddMouseTips.bind(this);
    this._toggleCursor = this._toggleCursor.bind(this);
    this._onMeasureStart = this._onMeasureStart.bind(this);
    this._getPointsList = this._getPointsList.bind(this);
    this._getLineDistance = this._getLineDistance.bind(this);
    this.__bindPointPopup = this._bindPointPopup.bind(this);
 }

/**
 * @description 加载Measure组件
 * @param {any} map
 * @returns 
 */
MeasureControl.prototype.onAdd = function(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl measure-ctrl-group';
    this._container.textContent = 'Hello, world';
    this.state = 'off';
    this.geojsonList = {};
    this._map.on('click', this._onClick);
    this._map.on('dblclick', this._onDblClick);
    this._map.on('mousemove', this._onMousemove);

    this._measureOnButton = this._createNode('button','mapboxgl-ctrl-icon mapboxgl-ctrl-measure-on',this._container, 'measure-on',this._onMeasureStart);

    return this._container;
};

MeasureControl.DEFAULTS = {
    linestring : {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": []
        }
    },
    circleRadius: 3.5,
    circleColor: '#fff',
    lineColor: '#44bff0',
    lineWidth: 3,
    lineCap: 'round',
    lineJoin: 'round', 
    // cursorCrosshair: 'crosshair',
};

/**
 * @description 卸载Measure组件
 */
MeasureControl.prototype.onRemove = function() {
    this._container.parentNode.removeChild(this._container);
    this._map.off('click', this._onClick);
    this._map.off('dblclick', this._onDblClick);
    this._map.off('mousemove', this._onMousemove);
    this._map = undefined;
};

/**
 * @description 获取控件的默认位置
 * ['top-left','top-right','bottom-left','bottom-right']
 * @returns 
 */
MeasureControl.prototype.getDefaultPosition = function(){
    return 'top-left';
}

/**
 * @description 创建button，绑定button到对应父级，并返回button的引用
 * @param {string} className button的类名
 * @param {node} container button绑定的父级node
 * @param {string} ariaLabel button的aria-label属性值
 * @param {func} fn click事件触发的方法
 * @returns {node}
 */
MeasureControl.prototype._createNode = function(node,className,container, ariaLabel, fn){
    var a = document.createElement(node);
    a.className = className;
    a.setAttribute('aria-label',ariaLabel);
    if(fn) a.addEventListener('click', fn);
    container.appendChild(a);
    return a;
}

MeasureControl.prototype._removeNode = function(node, fn) {
    node.remove();
    if(fn) node.removeEventListener('click', fn);
}


/**
 * @description map的click事件
 * @param {any} e
 */
MeasureControl.prototype._onClick = function(e){
    
    if(this.state === 'off') return;

    var map = this._map;
    var features = map.queryRenderedFeatures(e.point, { layers: ['measure-points-' + this._name] });
    this.point = [e.lngLat.lng, e.lngLat.lat];

    //画点
    var point = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": this.point
        },
        "properties": {
            "id": String(new Date().getTime()),
            "curDistance": 0.0,
            "prevDistance": 0.0
        }
    };

    this.curGeojson.features.push(point);
        
    //画线
    var PointList = this._getPointsList();
    if(PointList.length >=2) {
        this.lineString.geometry.coordinates = PointList.map(function(point) {
            return point.geometry.coordinates;
        });


        //计算距离
        this.prevDis = this.curDis || 0.0;
        this.curDis = this._getLineDistance(this.lineString, 'kilometers');

        //将距离放到每个点的properties里
        var last = this.curGeojson.features.length - 1;
        this.curGeojson.features[last].properties.curDistance = this.curDis;
        this.curGeojson.features[last].properties.prevDistance = this.prevDis;
        
        this.curGeojson.features.push(this.lineString);
    }

    

    //设置map的dataSource
    map.getSource('measure-geojson-' + this._name).setData(this.curGeojson);

    //每个point绑定popup
    this._bindPointPopup(PointList);
     
}

/**
 * @description 计算线段的距离
 * @param {geojson} geojson geometry的type为LineString
 * @param {unit} 测量单位
 * @return {Number} 距离
 */
MeasureControl.prototype._getLineDistance = function(lineString,unit) {
    return turf.lineDistance(lineString, unit).toLocaleString();
}

/**
 * @description 获取所有的Point geojson格式
 * @return {Array} Point数组
 */
MeasureControl.prototype._getPointsList = function(){
    return this.curGeojson.features.filter(function(item) {
        return item.geometry.type === 'Point';
    });
}


MeasureControl.prototype._bindPointPopup = function(list) {

    var _this = this;
    
    //清除原先所有的popup
    this.geojsonList[this._name].popups.map(function(popup){
        popup.remove();
    });

    //重新绑定popup
    list.map(function(point) {

        var popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false, 
                total:point.properties.curDistance, 
                prev: point.properties.prevDistance
            })
            .setLngLat(point.geometry.coordinates)
            .setHTML("总距离：" +point.properties.curDistance + "km")
            .addTo(this.map);

        popup._container.className += ' mapbox-measure-popup';
        _this.geojsonList[_this._name].popups.push(popup);

    });

}

/** 
 * @description map的dblClick事件
 * @param {any} e
 */
MeasureControl.prototype._onDblClick = function(e){

    if(this.state === 'off') return;

    this._toggleState('off');

    //删除鼠标跟随tips
    this._removeNode(this.tips);

    //修改鼠标手势
    this._toggleCursor('-webkit-grab');
    
    //创建删除当前测距的button
    
}

/**
 * @description map的点击测距按钮事件，进入测距模式，删除map的其他点击事件，禁用map的双击放大效果
 * @param {any} e
 */
MeasureControl.prototype._onMeasureStart = function(e){
    
    if(this.state === 'on') return;

    //进入测距模式
    this._toggleState('on');

    //禁用map双击放大效果
    this._map.doubleClickZoom.disable();

    //禁用map的其他click事件
    
    //初始化总距离、之前的距离
    this.prevDis = 0.0;
    this.curDis = 0.0;

    //设置鼠标手势
    this._toggleCursor('crosshair');

    //创建跟随鼠标提示框
    this.mouseTips = this._onAddMouseTips(e);

    //设置当前测距实例的唯一key
    this._name = String(new Date().getTime());


    //保存当前的测绘、popup

    
    //创建当前测距的mapSource、mapLayer
    this._onAddSourceLayer(e);
   
   

}

/**
 * @description 创建鼠标跟随提示框
 * @param {event} 鼠标点击事件
 */
MeasureControl.prototype._onAddMouseTips = function(e){
    var tips = this.tips =  this._createNode('div','measure_mousemove_tips',document.body,'mousemove_tips');
    //设置tips的样式
    tips.style.position = 'absolute';
    this._setTipsPosition(e,tips);
    tips.innerText = '单击确定起点';
    
    return tips;
}

//TODO 超出固定边界的话。。。
/**
 * @description 设置鼠标跟随tips的位置
 * @param {event} 鼠标移动事件
 * @param {tips} tips对应的dom元素
 */
MeasureControl.prototype._setTipsPosition = function(e,tips){
    var x = e.pageX || e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft);
    var y = e.pageY || e.clientY + (document.documentElement.scrollLeft || document.body.scrollLeft);
    tips.style.left = x + 10 + 'px';
    tips.style.top = y + 10 + 'px';
    tips.style.width = '100px';
    tips.style.height = '30px';
    tips.style.background = '#fff';
}

/**
 * @description 创建MeasureControl的mapSource、mapLayer
 */
MeasureControl.prototype._onAddSourceLayer = function(){
    //样式
    var circleRadius = this.options.circleRadius;
    var circleColor = this.options.circleColor;
    var lineWidth = this.options.lineWidth;
    var lineColor = this.options.lineColor;
    var lineCap = this.options.lineCap;
    var lineJoin = this.options.lineJoin;
    this.curGeojson = {
        "type": "FeatureCollection",
        "features": []
    };

    this.lineString = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": []
        }
    };
    //dataSource
    this._map.addSource('measure-geojson-' + this._name, {
        "type": "geojson",
        "data": this.curGeojson
    });
    
    //线图层
    this._map.addLayer({
        id: 'measure-lines-' + this._name,
        type: 'line',
        source: 'measure-geojson-' + this._name,
        layout: {
            'line-cap': lineCap,
            'line-join': lineJoin
        },
        paint: {
            'line-color': lineColor,
            'line-width': lineWidth
        },
        filter: ['in', '$type', 'LineString']
    });

    //点图层
    this._map.addLayer({
        id: 'measure-points-' + this._name,
        type: 'circle',
        source: 'measure-geojson-' + this._name,
        paint: {
            'circle-stroke-width': lineWidth,
            'circle-stroke-color': lineColor,
            'circle-radius': circleRadius,
            'circle-color': circleColor,
        },
        filter: ['in', '$type', 'Point']
    });

     //保存所有的测绘feature、popup
    this.geojsonList[this._name] = {geojson: this.curGeojson,popups: []};
}


/**
 * @description map的点击测距按钮事件，结束测距模式
 * @param {any} e
 */
MeasureControl.prototype._onMeasureEnd = function(e){
    console.log('结束测距模式');
    this._toggleState('off');

    this._map.doubleClickZoom.enable();
}

/**
 * @description map的mousemove事件
 * @param {any} e
 */
MeasureControl.prototype._onMousemove = function(e){

    if(this.state === 'off') return;

    //更新tips的位置
    this._setTipsPosition(e.originalEvent,this.tips);
    //tips的文字


}

/**
 * @description Measure组件的状态切换
 * @param {string} Oneof ['on','off']
 * @return {bool} 是否处于测距状态
 */
MeasureControl.prototype._toggleState = function(state) {
    this.state = state;
}

/**
 * @description 鼠标手势的切换
 * @param {string} 鼠标手势
 */
MeasureControl.prototype._toggleCursor = function(cursor) {
    this._map.getCanvas().style.cursor = cursor;
}
