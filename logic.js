
// Leaflet map
const INDIA_CENTER = [17.0, 77.1];
var mymap, markerGroup, routeGroup;

var startIcon = L.VectorMarkers.icon({ markerColor: 'green' });
var endIcon = L.VectorMarkers.icon({ markerColor: 'red' });
var startMarker, endMarker;
var ways, quality;

function onMapClick(e) {
  console.log("You clicked the map at " + e.latlng);
  if (vm.mode == 'start') {
    if (startMarker) {
       markerGroup.removeLayer(startMarker);
    }
    startMarker = L.marker(e.latlng, { icon: startIcon, draggable: true });
    markerGroup.addLayer(startMarker);
    callOSRM('nearest', [[e.latlng.lng, e.latlng.lat]], null, 
      resp => {
        vm.startLoc = (resp.waypoints[0].name != '') ? resp.waypoints[0].name : resp.waypoints[0].location;
      });
    vm.selected = false;
  } else if (vm.mode == 'end') {
    if (endMarker) {
       markerGroup.removeLayer(endMarker);
    }
    endMarker = L.marker(e.latlng, { icon: endIcon, draggable: true });
    markerGroup.addLayer(endMarker);
    callOSRM('nearest', [[e.latlng.lng, e.latlng.lat]], null, 
      resp => {
        vm.endLoc = (resp.waypoints[0].name != '') ? resp.waypoints[0].name : resp.waypoints[0].location;
      });
    vm.selected = false;
  }

  if (startMarker && endMarker) {
    vm.noRoute = false;
  }
  vm.mode = '';
}

// Quality - colour mapping
const QUALITY_COL = { bad: 'orangered', intermediate: 'gold', good: 'lawngreen', excellent: 'green', none: 'blue' };

// Generate quality feature geoJSON
function qualityFeatures(points, qs) {
  var collection = { type: 'FeatureCollection', 
    features: [] };
  for (var i = 1; i < points.length; i++) {
    var feature = { type: 'Feature', geometry: {
        type: 'LineString', coordinates: [points[i - 1], points[i]],
      },
      properties: { quality: qs[i - 1].quality }
    }
    collection.features.push(feature);
  }
  return collection;
}

function initMap() {
  mymap = L.map('mapid').setView(INDIA_CENTER, 10);
  
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 11, minZoom: 5,
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
  }).addTo(mymap);
  mymap.on('click', onMapClick);
  markerGroup = L.layerGroup().addTo(mymap);
  routeGroup = L.layerGroup().addTo(mymap);
}

// Endpoint URL
const SERVER_URL = 'http://mapnik.narenma.net';

// Call to search
const SEARCH_URL = SERVER_URL + '/map/search';
function callSearch(q) {
  var url = SEARCH_URL;
  var params = { q: q };
  vm.$http.get(url, { params: params }).then(response => {
  });
}

// Call to OSRM
const OSRM_SERVER = SERVER_URL + '/osrm/';
const OSRM_PROFILE = '/v1/driving/';

// Pass service, array of [lon, lat] and params hash
function callOSRM(service, coords, params, callback) {
  var url = OSRM_SERVER + service + OSRM_PROFILE;
  for (var i in coords) {
    url += coords[i][0] + ',' + coords[i][1];
    if (i != (coords.length - 1)) url += ';';
  }
  vm.$http.get(url, { params: params }).then(response => {
    var resp = response.body;
    if (resp.code == 'Ok') {
      callback(resp);
    }
  }, response => { console.log('url get error'); });
}

// Call to map
const MAP_SERVER = SERVER_URL + '/map/';

// Pass nodes
function viewMap(nodes, callback) {
  var url = MAP_SERVER + 'view';
  vm.$http.post(url, { body: nodes })
  .then(response => {
    var resp = response.body;
    callback(resp);
  }, response => { console.log('url post error'); });
}

function editMap(data, callback) {
  var url = MAP_SERVER + 'edit';
  vm.$http.post(url, { body: data }).then(response => {
    var resp = response.body;
    callback(resp);
  }, response => { 
    vm.saving = false;
    console.log('url post error'); 
  });
}

// Uniquify ways out of view response
function uniqueWays(respWays) {
  var ret = new Set();
  for (wayObj in respWays) {
    for (way in respWays[wayObj].ways) {
       ret.add(respWays[wayObj].ways[way]);
    }
  }
  return Array.from(ret);
}

// Vue instance
var vm;

function initVm() {
  vm = new Vue({
    el: '#app',
    data: {
      startLoc: '',
      endLoc: '',
      selected: false,
      modified: false,
      saving: false,
      noRoute: true,
      mode: '',
      stat: 'Waiting',
      nodes: 0
    },
    methods: {
      search: function(loc) {
        var q;
        vm.mode = loc;
        if (loc == 'start')
          q = vm.startLoc;
        else
          q = vm.endLoc;
        callSearch(q);
      },
      route: function() {
        var coords = [];
        coords[0] = [startMarker.getLatLng().lng, startMarker.getLatLng().lat];
        coords[1] = [endMarker.getLatLng().lng, endMarker.getLatLng().lat];
        vm.modified = false;
        vm.stat = 'Routing...';
        callOSRM('route', coords, { annotations: 'nodes', geometries: 'geojson' },
          resp => {
            var route = resp.routes[0].geometry; // geojson
            routeGroup.clearLayers();
            var routeLayer = L.geoJSON(route);
            routeGroup.addLayer(routeLayer);
            vm.nodes = resp.routes[0].legs[0].annotation.nodes.length;
            vm.stat = 'Fetch quality...';
            viewMap(route.coordinates,
              resp => {
                // Store way IDs
                ways = uniqueWays(resp);
                routeGroup.clearLayers();
                geom = qualityFeatures(route.coordinates, resp);
                var qualityLayer = L.geoJSON(geom, {
                  style: feature => {
                    return { color: QUALITY_COL[feature.properties.quality] };
                  }
                })
                routeGroup.addLayer(qualityLayer);
                vm.selected = true;
                vm.stat = 'Waiting';
              });
          }
        );
      },
      setQ: function(q) {
        quality = q;
        routeGroup.eachLayer(function (layer) {
           layer.setStyle({ color: QUALITY_COL[q], opacity: 0.5 });
        });
        vm.modified = true;
      },
      save: function() {
        vm.saving = true;
	vm.stat = 'Saving...';
        editMap({ ways: ways, quality: quality }, resp => {
          vm.modified = false;
          vm.saving = false;
	  vm.stat = 'Waiting';
        });
      },
      clear: function() {
        if (routeGroup) routeGroup.clearLayers();
        if (markerGroup) markerGroup.clearLayers();
        vm.selected = false;
        vm.noRoute = true;
      }
    }
  })
}

window.onload = function() {
  initVm();
  initMap();
};

