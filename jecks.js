var mainMap, modalMap, chosenLocation;
var treeDataLayer, addTreeLayer, deleteTreeLayer;
var isInDeleteMode = false;
var selectedTreeMarker = null;
var selectedUprootType = "";

function initializeModalMap() {
  if (!modalMap) {
    modalMap = L.map("treeLocationMap").setView([19.0211, 72.8710], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(modalMap);

    var geocoder = L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: "Search for location...",
      showResultIcons: true,
    }).addTo(modalMap);

    geocoder.on("markgeocode", function (e) {
      var latlng = e.geocode.center;
      modalMap.setView(latlng, 16);
      if (chosenLocation) {
        modalMap.removeLayer(chosenLocation);
      }
      chosenLocation = L.marker(latlng).addTo(modalMap);
    });

    modalMap.on("click", function (e) {
      if (chosenLocation) {
        modalMap.removeLayer(chosenLocation);
      }
      chosenLocation = L.marker(e.latlng).addTo(modalMap);
    });
  } else {
    modalMap.invalidateSize();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  mainMap = L.map("map").setView([19.0211, 72.8710], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(mainMap);

  treeDataLayer = L.layerGroup().addTo(mainMap);
  addTreeLayer = L.layerGroup().addTo(mainMap);
  deleteTreeLayer = L.layerGroup().addTo(mainMap);

  fetchInitialTreeData();

  document.getElementById("submitTreeButton").addEventListener("click", function (event) {
    event.preventDefault();
    submitTreeData();
  });

  $("#addTreeModal").on("shown.bs.modal", function () {
    initializeModalMap();
  });

  document.getElementById("deleteTreeSubmit").addEventListener("click", function () {
    var deleteTreeType = selectedUprootType;

    if (!selectedTreeMarker) {
      alert("Please select a tree to delete.");
      return;
    }

    var treeId = selectedTreeMarker.feature.properties.ID;

    deleteTree(treeId, deleteTreeType);
  });

  document.getElementById("deleteTreeButton").addEventListener("click", function () {
    isInDeleteMode = !isInDeleteMode;
    if (isInDeleteMode) {
      alert("Delete mode activated. Click on a tree to delete.");
      mainMap.getContainer().style.cursor = "crosshair";
    } else {
      mainMap.getContainer().style.cursor = "";
      if (selectedTreeMarker) {
        treesLayer.resetStyle(selectedTreeMarker);
        selectedTreeMarker = null;
      }
    }
  });

  mainMap.on("click", function (e) {
    if (isInDeleteMode) {
      selectLocationForDeletion(e.latlng);
    }
  });

  // Handle the upvote and downvote buttons for deletion options
  document.querySelectorAll('.option-container .upvote, .option-container .downvote').forEach(function(button) {
    button.addEventListener('click', function() {
      var uprootType = this.closest('.option-container').querySelector('h3').textContent;
      selectedUprootType = uprootType.toLowerCase().includes('half') ? 'half' : 'full';
    });
  });

  fetchInitialTreeData();
});

function fetchInitialTreeData() {
  fetch("http://localhost:5000/get_tree_data")
    .then((response) => response.json())
    .then((data) => {
      var geoJsonLayer = L.geoJSON(data, {
        onEachFeature: function (feature, layer) {
          if (feature.properties && feature.properties.Type) {
            layer.bindPopup(
              "Type: " +
                feature.properties.Type +
                "<br>Height: " +
                feature.properties.Height +
                " m" +
                "<br>Age: " +
                feature.properties.Age +
                " years" +
                "<br>ID: " +
                feature.properties.ID
            );
          }
          layer.on("click", function (e) {
            if (isInDeleteMode) {
              if (selectedTreeMarker) {
                treesLayer.resetStyle(selectedTreeMarker);
              }
              selectedTreeMarker = e.target;
              treesLayer.setStyle({ color: "red" });
            }
          });
        },
      }).addTo(treeDataLayer);
      mainMap.fitBounds(treeDataLayer.getBounds());
    })
    .catch((error) => {
      console.error("Error fetching tree data:", error);
    });
}

function submitTreeData() {
  var lat = chosenLocation ? chosenLocation.getLatLng().lat : null;
  var lng = chosenLocation ? chosenLocation.getLatLng().lng : null;

  if (!lat || !lng) {
    console.log("No location selected.");
    alert("Please select a location on the map.");
    return;
  }

  var treeData = {
    name: document.getElementById("treeName").value,
    age: parseInt(document.getElementById("treeAge").value, 10),
    height: parseFloat(document.getElementById("treeHeight").value),
    latitude: lat,
    longitude: lng,
  };

  fetch("http://localhost:5000/add_tree", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(treeData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        alert("Tree added successfully");
        $("#addTreeModal").modal("hide");
        fetchInitialTreeData();
        addLocationMarker(lat, lng, 'green');
      } else {
        alert("Failed to add tree: " + data.message);
      }
    })
    .catch((error) => {
      console.error("Error adding tree:", error);
      alert("Error adding tree: " + error.message);
    });

  var marker = L.marker([lat, lng]).addTo(addTreeLayer);
}

function selectLocationForDeletion(latlng) {
  var color = selectedUprootType === 'full' ? 'red' : 'purple';
  addLocationMarker(latlng.lat, latlng.lng, color);
}

function addLocationMarker(lat, lng, color) {
  var icon = L.divIcon({
    className: 'custom-icon',
    html: `<i class="fa fa-map-marker" style="color: ${color}; font-size: 24px;"></i>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });

  L.marker([lat, lng], { icon: icon }).addTo(deleteTreeLayer);
}

function deleteTree(treeId, uprootType) {
  var marker = selectedTreeMarker;
  var lat = marker.getLatLng().lat;
  var lng = marker.getLatLng().lng;

  fetch("http://localhost:5000/delete_tree", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tree_id: treeId, uproot_type: uprootType }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        alert("Tree successfully deleted.");
        fetchInitialTreeData();
        var color = uprootType === 'full' ? 'orange' : 'purple';
        addLocationMarker(lat, lng, color);
      } else {
        alert("Failed to delete tree: " + data.message);
      }
    })
    .catch((error) => {
      console.error("Error deleting tree:", error);
    });

  marker.remove();
}
