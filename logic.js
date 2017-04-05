
// Leaflet map
const INDIA_CENTER = [17.0, 77.1];
var mymap, markerGroup, routeGroup;

var startIcon = L.VectorMarkers.icon({ markerColor: 'green' });
var endIcon = L.VectorMarkers.icon({ markerColor: 'red' });
var startMarker, endMarker;

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
        vm.startLoc = (resp.waypoints[0].name != '') ? resp.waypoints[0].name : 'UNKNOWN';
      });
  } else if (vm.mode == 'end') {
    if (endMarker) {
       markerGroup.removeLayer(endMarker);
    }
    endMarker = L.marker(e.latlng, { icon: endIcon, draggable: true });
    markerGroup.addLayer(endMarker);
    callOSRM('nearest', [[e.latlng.lng, e.latlng.lat]], null, 
      resp => {
        vm.endLoc = (resp.waypoints[0].name != '') ? resp.waypoints[0].name : 'UNKNOWN';
      });
  }

  if (startMarker && endMarker) {
    vm.noRoute = false;
  }
  vm.mode = '';
}

function initMap() {
  mymap = L.map('mapid').setView(INDIA_CENTER, 6);
  
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 11, minZoom: 5,
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
  }).addTo(mymap);
  mymap.on('click', onMapClick);
  markerGroup = L.layerGroup().addTo(mymap);
  routeGroup = L.layerGroup().addTo(mymap);
}

// Call to OSRM
const OSRM_SERVER = 'http://mapnik.narenma.net/osrm/';
const OSRM_PROFILE = '/v1/driving/';

// Pass service, array of [lon, lat] and params hash
function callOSRM(service, coords, params, callback) {
  var url = OSRM_SERVER + service + OSRM_PROFILE;
  for (var i in coords) {
    url += coords[i][0] + ',' + coords[i][1];
    if (i != (coords.length - 1)) url += ';';
  }
  if (params && Object.keys(params).length > 0) {
    url += '?';
    for (var i in params) {
      url += i + '=' + params[i] + '&';
    }
    url = url.slice(0, -1);
  }
  console.log(url);
  vm.$http.get(url).then(response => {
    var resp = response.body;
    if (resp.code == 'Ok') {
      callback(resp);
    }
  }, response => { console.log('url get error'); });
}

// Vue instance
var vm;

function initVm() {
  vm = new Vue({
    el: '#app',
    data: {
      startLoc: 'Pick start',
      endLoc: 'Pick end',
      selected: false,
      modified: false,
      noRoute: true,
      mode: ''
    },
    methods: {
      route: function() {
        var coords = [];
        coords[0] = [startMarker.getLatLng().lng, startMarker.getLatLng().lat];
        coords[1] = [endMarker.getLatLng().lng, endMarker.getLatLng().lat];
        callOSRM('route', coords, { annotations: 'nodes', geometries: 'geojson' },
          resp => {
            var route = resp.routes[0].geometry; // geojson
            routeGroup.clearLayers();
            var routeLayer = L.geoJSON(route);
            routeGroup.addLayer(routeLayer);
          }
        );
      },
      setQ: function(q) {
        console.log(q);
      }
    }
  })
}

window.onload = function() {
  initVm();
  initMap();
};

