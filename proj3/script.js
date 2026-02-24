let currentLat, currentLon;
let searchTimeout;

// Search for location by name
async function searchLocation() {
  const searchInput = document.getElementById("searchInput");
  const query = searchInput.value.trim();

  if (!query) return;

  try {
    // Use Nominatim to search for location
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
    );
    const results = await response.json();

    if (results.length > 0) {
      const result = results[0];
      currentLat = parseFloat(result.lat);
      currentLon = parseFloat(result.lon);

      // Update location name
      await getLocationName(currentLat, currentLon);

      // Hide suggestions
      document.getElementById("searchSuggestions").classList.add("hidden");
      document.getElementById("searchSuggestions").innerHTML = "";
      searchInput.value = "";

      // Reload weather data
      await loadWeatherData();
      initVentuskyRadar();
      updateLastUpdated();
    } else {
      showError("Location not found. Please try another search.");
    }
  } catch (error) {
    showError("Error searching location: " + error.message);
  }
}

// Show search suggestions as user types
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();

    if (query.length < 2) {
      document.getElementById("searchSuggestions").classList.add("hidden");
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        );
        const results = await response.json();
        const suggestionsContainer =
          document.getElementById("searchSuggestions");
        suggestionsContainer.innerHTML = "";

        if (results.length > 0) {
          results.forEach((result) => {
            const suggestionItem = document.createElement("div");
            suggestionItem.className = "suggestion-item";
            suggestionItem.textContent = result.display_name;
            suggestionItem.onclick = () => {
              searchInput.value = result.display_name;
              currentLat = parseFloat(result.lat);
              currentLon = parseFloat(result.lon);
              suggestionsContainer.classList.add("hidden");
              loadWeatherData();
              getLocationName(currentLat, currentLon);
              initVentuskyRadar();
              updateLastUpdated();
            };
            suggestionsContainer.appendChild(suggestionItem);
          });
          suggestionsContainer.classList.remove("hidden");
        } else {
          suggestionsContainer.classList.add("hidden");
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    }, 300);
  });

  // Close suggestions when clicking outside
  document.addEventListener("click", function (e) {
    if (
      !e.target.closest(".search-wrapper") &&
      !e.target.closest(".search-suggestions")
    ) {
      document.getElementById("searchSuggestions").classList.add("hidden");
    }
  });
});

// Allow Enter key to search
document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("searchInput")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        searchLocation();
      }
    });
});

// Initialize the app
async function init() {
  try {
    // Get user location or use default (Lynchburg, VA)
    try {
      const position = await getUserLocation();
      currentLat = position.coords.latitude;
      currentLon = position.coords.longitude;
    } catch (locationError) {
      // Default to Lynchburg, VA if geolocation fails
      console.log("Using default location: Lynchburg, VA");
      currentLat = 37.4138;
      currentLon = -79.1422;
    }

    // Get location name
    await getLocationName(currentLat, currentLon);

    // Load weather data
    await loadWeatherData();

    // Initialize Ventusky radar
    initVentuskyRadar();

    // remove unwanted parts of the Ventusky interface
    const ventuskyIframe = document.getElementById("ventusky-radar");
    // get rid of items with id "d" and id "i" in the iframe
    console.log(ventuskyIframe.contentWindow.document);
    ventuskyIframe.onload = () => {
      const ventuskyDoc = ventuskyIframe.contentWindow.document;
      const dElement = ventuskyDoc.getElementById("d");
      const iElement = ventuskyDoc.getElementById("i");
      if (dElement) dElement.style.display = "none";
      if (iElement) iElement.style.display = "none";
      console.log(
        "now it looks like this: ",
        ventuskyIframe.contentWindow.document,
      );
    };
    // Show main content
    document.getElementById("loadingScreen").classList.add("hidden");
    document.getElementById("mainContent").classList.remove("hidden");

    // Update last updated time
    updateLastUpdated();
  } catch (error) {
    showError(error.message);
  }
}

// Get user's location using browser's Geolocation API
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(
        new Error(
          "Unable to get your location. Please enable location services.",
        ),
      );
    });
  });
}

// Get location name using reverse geocoding
async function getLocationName(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
    );
    const data = await response.json();

    const city =
      data.address.city ||
      data.address.town ||
      data.address.village ||
      "Unknown Location";
    const state = data.address.state || "";
    const country = data.address.country || "";

    document.getElementById("locationInfo").textContent = `${city}, ${state}`;
  } catch (error) {
    document.getElementById("locationInfo").textContent =
      `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

// Load weather data from Open-Meteo API (free and no key required)
async function loadWeatherData() {
  try {
    // Using Open-Meteo API for weather data (free, no key needed)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;

    const response = await fetch(weatherUrl);
    const data = await response.json();

    // Update current weather
    updateCurrentWeather(data);

    // Update hourly forecast
    updateHourlyForecast(data);

    // Update daily forecast
    updateDailyForecast(data);

    // Check for weather warnings (simplified - based on weather codes)
    checkWeatherWarnings(data);
  } catch (error) {
    throw new Error("Failed to load weather data: " + error.message);
  }
}

// Update current weather display
function updateCurrentWeather(data) {
  const current = data.current;

  document.getElementById("currentTemp").textContent =
    `${Math.round(current.temperature_2m)}°F`;
  document.getElementById("feelsLike").textContent =
    `${Math.round(current.apparent_temperature)}°F`;
  document.getElementById("humidity").textContent =
    `${current.relative_humidity_2m}%`;
  document.getElementById("wind").textContent =
    `${Math.round(current.wind_speed_10m)} mph`;
  document.getElementById("precipitation").textContent =
    `${current.precipitation.toFixed(2)} in`;
  document.getElementById("weatherDesc").textContent = getWeatherDescription(
    current.weather_code,
  );
}

// Update hourly forecast
function updateHourlyForecast(data) {
  const hourlyContainer = document.getElementById("hourlyForecast");
  hourlyContainer.innerHTML = "";

  // Show next 24 hours
  for (let i = 0; i < 24; i++) {
    const time = new Date(data.hourly.time[i]);
    const temp = Math.round(data.hourly.temperature_2m[i]);
    const weatherCode = data.hourly.weather_code[i];
    const precipProb = data.hourly.precipitation_probability[i];

    const hourlyItem = document.createElement("div");
    hourlyItem.className = "hourly-item";
    hourlyItem.innerHTML = `
                    <div class="hourly-time">${time.getHours()}:00</div>
                    <div class="hourly-temp">${temp}°F</div>
                    <div class="hourly-desc">${getWeatherEmoji(weatherCode)}</div>
                    <div class="hourly-desc">${precipProb}%</div>
                `;
    hourlyContainer.appendChild(hourlyItem);
  }
}

// Update daily forecast
function updateDailyForecast(data) {
  const dailyContainer = document.getElementById("dailyForecast");
  dailyContainer.innerHTML = "";

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  for (let i = 0; i < 7; i++) {
    const date = new Date(data.daily.time[i]);
    const dayName = i === 0 ? "Today" : days[date.getDay()];
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const weatherCode = data.daily.weather_code[i];
    const precip = data.daily.precipitation_sum[i];

    const dailyItem = document.createElement("div");
    dailyItem.className = "daily-item";
    dailyItem.innerHTML = `
                    <div class="daily-day">
                        <div>${dayName}</div>
                        <div style="font-size: 12px; color: #666;">${getWeatherDescription(weatherCode)}</div>
                    </div>
                    <div style="font-size: 12px; color: #666;">${precip.toFixed(2)}" rain &nbsp;</div>
                    <div class="daily-temps">
                        <span class="daily-high">${high}°</span>
                        <span class="daily-low">${low}°</span>
                    </div>
                `;
    dailyContainer.appendChild(dailyItem);
  }
}

// Check for weather warnings based on weather codes
function checkWeatherWarnings(data) {
  const warningsCard = document.getElementById("warningsCard");
  const warningsContainer = document.getElementById("warningsContainer");
  warningsContainer.innerHTML = "";

  const warnings = [];

  console.log("checking Weather Warnings");

  // Check current weather
  const currentCode = data.current.weather_code;
  if (currentCode >= 95) {
    warnings.push({
      title: "Thunderstorm Warning",
      desc: "Severe thunderstorms are occurring in your area. Stay indoors and avoid open areas.",
    });
  } else if (currentCode >= 71 && currentCode <= 77) {
    warnings.push({
      title: "Snow Warning",
      desc: "Snowfall is occurring or expected. Drive carefully and prepare for winter conditions.",
    });
  } else if (data.current.wind_speed_10m > 25) {
    warnings.push({
      title: "High Wind Advisory",
      desc: `Strong winds at ${Math.round(data.current.wind_speed_10m)} mph. Secure loose objects.`,
    });
  }

  // Check for heavy precipitation
  if (data.current.precipitation > 0.5) {
    warnings.push({
      title: "Heavy Precipitation",
      desc: "Heavy rain or snow is falling. Exercise caution when traveling.",
    });
  }

  // Display warnings
  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      const warningItem = document.createElement("div");
      warningItem.className = "warning-item";
      warningItem.innerHTML = `
                        <div class="warning-title">${warning.title}</div>
                        <div class="warning-desc">${warning.desc}</div>
                    `;
      warningsContainer.appendChild(warningItem);
    });
    warningsCard.classList.remove("hidden");
  } else {
    warningsCard.classList.add("hidden");
  }
}

// Initialize Ventusky radar
function initVentuskyRadar() {
  const iframe = document.getElementById("ventusky-radar");
  // Ventusky iframe URL with radar overlay
  iframe.src = `https://www.ventusky.com/?p=${currentLat};${currentLon};8&l=radar&t=20260217/00`;
}

// Get weather description from code
function getWeatherDescription(code) {
  const descriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm",
  };
  return descriptions[code] || "Unknown";
}

// Get weather emoji from code
function getWeatherEmoji(code) {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 55) return "🌦️";
  if (code >= 61 && code <= 65) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

// Update last updated time
function updateLastUpdated() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  document.getElementById("lastUpdated").textContent =
    `Last updated: ${timeString}`;
}

// Refresh weather data
async function refreshWeather() {
  try {
    document.getElementById("errorScreen").classList.add("hidden");
    await loadWeatherData();
    // reset the Ventusky radar to the search location or current location
    initVentuskyRadar();

    updateLastUpdated();
  } catch (error) {
    showError("Failed to refresh weather data: " + error.message);
  }
}

// Show error message
function showError(message) {
  document.getElementById("loadingScreen").classList.add("hidden");
  document.getElementById("mainContent").classList.add("hidden");
  const errorScreen = document.getElementById("errorScreen");
  errorScreen.textContent = message;
  errorScreen.classList.remove("hidden");
}

// Start the app when page loads
window.addEventListener("load", init);
