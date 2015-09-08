import classBreaksRenderer from './Renderers/ClassBreaksRenderer';
import uniqueValueRenderer from './Renderers/UniqueValueRenderer';
import simpleRenderer from './Renderers/simpleRenderer';

L.esri.FeatureLayer.addInitHook(function () {
  var oldOnAdd = L.Util.bind(this.onAdd, this);
  var oldUnbindPopup = L.Util.bind(this.unbindPopup, this);
  var oldOnRemove = L.Util.bind(this.onRemove, this);
  L.Util.bind(this.createNewLayer, this);

  this._metadataLoaded = false;

  this.metadata(function (error, response) {
    if (response && response.drawingInfo && !this.options.style) {
      this._setRenderers(response);
    }
    this._metadataLoaded = true;
    /* jshint ignore:start */
    if (this._addToMap) {
      oldOnAdd(map);
      this._addPointLayer(map);
    }
  /* jshint ignore:end */
  }, this);

  this.onAdd = function (map) {
    this._addToMap = true;
    if (this._metadataLoaded) {
      oldOnAdd(map);
      this._addPointLayer(map);
    }
  };

  this.onRemove = function (map) {
    oldOnRemove(map);
    if (this._pointLayer) {
      var pointLayers = this._pointLayer.getLayers();
      for (var i in pointLayers) {
        map.removeLayer(pointLayers[i]);
      }
    }
  };

  this.unbindPopup = function () {
    oldUnbindPopup();
    if (this._pointLayer) {
      var pointLayers = this._pointLayer.getLayers();
      for (var i in pointLayers) {
        pointLayers[i].unbindPopup();
      }
    }
  };

  this._addPointLayer = function (map) {
    if (this._pointLayer) {
      this._pointLayer.addTo(map);
      this._pointLayer.bringToFront();
    }
  };

  this._createPointLayer = function () {
    if (!this._pointLayer) {
      this._pointLayer = L.geoJson();

      if (this._popup) {
        var popupFunction = function (feature, layer) {
          layer.bindPopup(this._popup(feature, layer), this._popupOptions);
        };
        this._pointLayer.options.onEachFeature = L.Util.bind(popupFunction, this);
      }
    }
  };

  this.createNewLayer = function (geojson) {
    var fLayer = L.GeoJSON.geometryToLayer(geojson, this.options);

    // add a point layer when the polygon is represented as proportional marker symbols
    if (this._hasProportionalSymbols) {
      var centroid = this.getPolygonCentroid(geojson.geometry.coordinates);
      if (!(isNaN(centroid[0]) || isNaN(centroid[0]))) {
        this._createPointLayer();

        var pointjson = this.getPointJson(geojson, centroid);
        this._pointLayer.addData(pointjson);
        this._pointLayer.bringToFront();
      }
    }
    return fLayer;
  };

  this.getPolygonCentroid = function (coordinates) {
    var pts = coordinates[0][0];
    if (pts.length === 2) {
      pts = coordinates[0];
    }

    var twicearea = 0,
      x = 0, y = 0,
      nPts = pts.length,
      p1, p2, f;

    for (var i = 0, j = nPts - 1;i < nPts;j = i++) {
      p1 = pts[i]; p2 = pts[j];
      twicearea += p1[0] * p2[1];
      twicearea -= p1[1] * p2[0];
      f = p1[0] * p2[1] - p2[0] * p1[1];
      x += (p1[0] + p2[0]) * f;
      y += (p1[1] + p2[1]) * f;
    }
    f = twicearea * 3;
    return [x / f, y / f];
  };

  this.getPointJson = function (geojson, centroid) {
    return {
      type: 'Feature',
      properties: geojson.properties,
      id: geojson.id,
      geometry: {
        type: 'Point',
        coordinates: [centroid[0], centroid[1]]
      }
    };
  };

  this._checkForProportionalSymbols = function (geometryType, renderer) {
    this._hasProportionalSymbols = false;
    if (geometryType === 'esriGeometryPolygon') {
      if (renderer.backgroundFillSymbol) {
        this._hasProportionalSymbols = true;
      }
      // check to see if the first symbol in the classbreaks is a marker symbol
      if (renderer.classBreakInfos && renderer.classBreakInfos.length) {
        var sym = renderer.classBreakInfos[0].symbol;
        if (sym && (sym.type === 'esriSMS' || sym.type === 'esriPMS')) {
          this._hasProportionalSymbols = true;
        }
      }
    }
  };

  this._setRenderers = function (geojson) {
    var rend,
      rendererInfo = geojson.drawingInfo.renderer,
      options = {url: this.options.url};

    switch (rendererInfo.type) {
      case 'classBreaks':
        this._checkForProportionalSymbols(geojson.geometryType, rendererInfo);
        if (this._hasProportionalSymbols) {
          this._createPointLayer();
          var pRend = classBreaksRenderer(rendererInfo, options);
          pRend.attachStylesToLayer(this._pointLayer);
          options.proportionalPolygon = true;
        }
        rend = classBreaksRenderer(rendererInfo, options);
        break;
      case 'uniqueValue':
        rend = uniqueValueRenderer(rendererInfo, options);
        break;
      default:
        rend = simpleRenderer(rendererInfo, options);
    }
    rend.attachStylesToLayer(this);
  };
});
