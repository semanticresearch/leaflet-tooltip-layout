(function(factory, window) {
  if (typeof define === 'function' && define.amd) {
    define(['leaflet'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('leaflet'));
  }
  if (typeof window !== 'undefined' && window.L) {
    window.L.tooltipLayout = factory(L);
  }
})(function(L) {
  var TooltipLayout = {};

  // global variables
  let map;
  let markerList = []; // all markers here
  let polylineList = []; // all polylines here

  // events
  let _onPolylineCreated = null; // will be called after polyline has been created

  function initializeTooltipLayout(leafletMap) {
    map = leafletMap;
    polylineList = [];

    redrawLines();

    // event registrations
    map.on('zoomstart', function() {
      removeAllPolyline(map);
    });
  }

  function redrawLines() {
    setRandomPos(map);
    layoutByForce();
    setEdgePosition();
    drawLine(map);
  }

  function addMarker(marker) {
    markerList.push(marker)
  }

  function resetMarker(marker) {
    var name = marker.getTooltip().getContent();
    var options = marker.getTooltip().options;
    marker.unbindTooltip();

    marker.bindTooltip(name, {
      pane: options.pane,
      offset: options.offset,
      className: 'tooltip-layout',
      permanent: true,
      interactive: true,
      direction: 'left',
      sticky: 'none',
      opacity: options.opacity
    });

    if (marker.getTooltip()._container !== undefined) {
      marker.on('mouseover', function () {
        mouseOverEvent(marker);
      });

      marker.on('mouseout', function () {
        mouseOutEvent(marker);
      });

      markerList.push(marker);
    }
  }

  function mouseOverEvent(marker) {
    if (marker.getTooltip() === undefined || marker.getTooltip() === null) return;
    var toolTip = marker.getTooltip();

    // if (toolTip._container === undefined) return;
    // toolTip._container.style.border = '2px solid #FF0000';

    if (getLine(marker) !== undefined) {
      getLine(marker).setStyle({color: '#FF0000'});
    }
    toolTip.bringToFront();
  }

  function mouseOutEvent(marker) {
    if (marker.getTooltip() === undefined || marker.getTooltip() === null) return;
    // var toolTip = marker.getTooltip();

    // if (toolTip._container === undefined) return;
    // toolTip._container.style.border = '#000FFF';

    if (getLine(marker) !== undefined) {
      getLine(marker).setStyle({color: '#000FFF'});
    }
  }

  function getMarkers() {
    return markerList;
  }

  function getLine(marker) {
    return marker.__ply;
  }

  function removeAllPolyline(map) {
    var i;
    for (i = 0; i < polylineList.length; i++) {
      map.removeLayer(polylineList[i]);
    }
    polylineList = [];
  }

  function getAllPolyline() {
    return polylineList;
  }

  function removeAllMarkers() {
    markerList = [];
  }

  /**
   * Draw lines between markers and tooltips
   * @param map leaflet map
   */
  function drawLine(map) {
    removeAllPolyline(map);
    for (var i = 0; i < markerList.length; i++) {
      var marker = markerList[i];
      // var markerDom = marker._icon;
      var markerPosition = getMarkerPosition(marker);
      var label = marker.getTooltip();

      var labelDom = label._container;
      var labelPosition = getPosition(labelDom);

      var x1 = labelPosition.x;
      var y1 = labelPosition.y;

      var x = markerPosition.x;
      var y = markerPosition.y;

      x1 -= 5;
      y1 += 2;
      if (x1 - x !== 0 || y1 - y !== 0) {
        if (x1 + labelDom.offsetWidth < markerPosition.x) {
          x1 += labelDom.offsetWidth;
        }
        if (y1 + labelDom.offsetHeight < markerPosition.y) {
          y1 += labelDom.offsetHeight;
        }
        var lineDest = L.point(x1, y1);
        var destLatLng = map.layerPointToLatLng(lineDest);

        setTimeout(
          ((marker, destLatLng) => () => {
            let ply = L.polyline([marker.getLatLng(), destLatLng]);
            _onPolylineCreated && _onPolylineCreated(ply);
            marker.__ply = ply;
            // marker.__ply.addEventListener(marker.getEvents());
            polylineList.push(ply);
            ply.setStyle({
              color: '#000FFF'
            });
            ply.addTo(map);
          })(marker, destLatLng),
          0
        );
      }
    }
  }

  function setRandomPos() {
    for (var i = 0; i < markerList.length; i++) {
      var marker = markerList[i];
      var label = marker.getTooltip();
      var labelDom = label._container;
      // var markerDom = marker._icon;
      var markerPosition = getMarkerPosition(marker);
      // var angle = Math.floor(Math.random() * 19 + 1) * 2 * Math.PI / 20;
      var angle = ((2 * Math.PI) / 6) * i;
      var x = markerPosition.x;
      var y = markerPosition.y;
      var dest = L.point(
        Math.ceil(x + 50 * Math.sin(angle)),
        Math.ceil(y + 50 * Math.cos(angle))
      );
      L.DomUtil.setPosition(labelDom, dest);
    }
  }

  function scaleTo(a, b) {
    return L.point(a.x * b.x, a.y * b.y);
  }

  function normalize(a) {
    var l = a.distanceTo(L.point(0, 0));
    if (l === 0) {
      return a;
    }
    return L.point(a.x / l, a.y / l);
  }

  function fa(x, k) {
    return (x * x) / k;
  }

  function fr(x, k) {
    return (k * k) / x;
  }

  /**
   * get position form el.style.transform
   */
  function getPosition(el) {
    var translateString = el.style.transform
      .split('(')[1]
      .split(')')[0]
      .split(',');
    return L.point(parseInt(translateString[0]), parseInt(translateString[1]));
  }

  /**
   * get pixel position of the marker
   */
  function getMarkerPosition(el) {
    var pixelPoint = map.latLngToLayerPoint(el.getLatLng());
    return L.point(pixelPoint.x, pixelPoint.y);
  }

  /**
   * t is the temperature in the system
   */
  function computePositionStep(t) {
    var area = (window.innerWidth * window.innerHeight) / 10;
    var k = Math.sqrt(area / markerList.length);
    var dpos = L.point(0, 0);
    var v_pos;
    var v;
    var i;
    var length = markerList.length;

    if (markerList.length >= 400) {
      length = 400;
    }

    for (i = 0; i < length; i++) {
      v = markerList[i];
      // get position of label v
      v.disp = L.point(0, 0);
      var v_label = v.getTooltip()._container;
      v_pos = getPosition(v_label);

      // compute gravitational force
      for (var j = 0; j < length; j++) {
        var u = markerList[j];
        if (i !== j) {
          var u_label = u.getTooltip()._container;
          var u_pos = getPosition(u_label);
          dpos = v_pos.subtract(u_pos);
          if (dpos !== 0) {
            v.disp = v.disp.add(
              normalize(dpos).multiplyBy(fr(dpos.distanceTo(L.point(0, 0)), k))
            );
          }
        }
      }
    }

    // compute force between marker and tooltip
    for (i = 0; i < length; i++) {
      v = markerList[i];
      v_pos = getPosition(v.getTooltip()._container);
      dpos = v_pos.subtract(getMarkerPosition(v));
      v.disp = v.disp.subtract(
        normalize(dpos).multiplyBy(fa(dpos.distanceTo(L.point(0, 0)), k))
      );
    }

    // calculate layout
    for (i = 0; i < length; i++) {
      var disp = markerList[i].disp;
      var p = getPosition(markerList[i].getTooltip()._container);
      var d = scaleTo(
        normalize(disp),
        L.point(Math.min(Math.abs(disp.x), t), Math.min(Math.abs(disp.y), t))
      );
      p = p.add(d);
      p = L.point(Math.ceil(p.x), Math.ceil(p.y));
      L.DomUtil.setTransform(markerList[i].getTooltip()._container, p);
    }
  }

  function layoutByForce() {
    var start = Math.ceil(window.innerWidth / 10);
    var times;
    if (markerList.length <= 200) {
      times = 50;
    } else if (markerList.length > 200 && markerList.length < 400) {
      times = 10;
    } else {
      times = 1;
    }

    var t;
    for (var i = 0; i < times; i += 1) {
      t = start * (1 - i / (times - 1));
      computePositionStep(t);
    }

    for (i = 0; i < markerList.length; i++) {
      var p = getPosition(markerList[i].getTooltip()._container);
      var width = markerList[i].getTooltip()._container.offsetWidth;
      var height = markerList[i].getTooltip()._container.offsetHeight;
      p = L.point(Math.ceil(p.x - width / 2), Math.ceil(p.y - height / 2));
      L.DomUtil.setTransform(markerList[i].getTooltip()._container, p);
    }
  }

  function setEdgePosition() {
    var bounds = map.getBounds();
    var northWest = map.latLngToLayerPoint(bounds.getNorthWest());
    var southEast = map.latLngToLayerPoint(bounds.getSouthEast());
    var length = markerList.length;

    if (markerList.length >= 400) {
      length = 400;
    }

    for (let i = 0; i < length; i++) {
      var tooltip = getPosition(markerList[i].getTooltip()._container);
      var marker = getMarkerPosition(markerList[i]);
      var width = markerList[i].getTooltip()._container.offsetWidth;
      var height = markerList[i].getTooltip()._container.offsetHeight;

      var isEdge = false;
      if (marker.x > northWest.x && tooltip.x < northWest.x) {
        tooltip.x = northWest.x;
        isEdge = true;
      } else if (marker.x < southEast.x && tooltip.x > southEast.x - width) {
        tooltip.x = southEast.x - width;
        isEdge = true;
      }

      if (marker.y > northWest.y && tooltip.y < northWest.y) {
        tooltip.y = northWest.y;
        isEdge = true;
      } else if (marker.y < southEast.y && tooltip.y > southEast.y - height) {
        tooltip.y = southEast.y - height;
        isEdge = true;
      }

      if (!isEdge) {
        if (marker.x < northWest.x && tooltip.x > northWest.x - width) {
          tooltip.x = northWest.x - width;
        } else if (marker.x > southEast.x && tooltip.x < southEast.x) {
          tooltip.x = southEast.x;
        }

        if (marker.y < northWest.y && tooltip.y > northWest.y - height) {
          tooltip.y = northWest.y - height;
        } else if (marker.y > southEast.y && tooltip.y < southEast.y) {
          tooltip.y = southEast.y;
        }
      }

      L.DomUtil.setTransform(markerList[i].getTooltip()._container, tooltip);
    }
  }

  TooltipLayout['initializeTooltipLayout'] = initializeTooltipLayout;
  TooltipLayout['redrawLines'] = redrawLines;
  TooltipLayout['resetMarker'] = resetMarker;
  TooltipLayout['getMarkers'] = getMarkers;
  TooltipLayout['addMarker'] = addMarker;
  TooltipLayout['getLine'] = getLine;
  TooltipLayout['removeAllPolyline'] = removeAllPolyline;
  TooltipLayout['removeAllMarkers'] = removeAllMarkers;
  TooltipLayout['getAllPolyline'] = getAllPolyline;

  return TooltipLayout;
}, window);
