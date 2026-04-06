const fetch = require("node-fetch");

const resolveCoordinatesFromIp = async (ip) => {
  try {
    const isPrivate = !ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.");
    const url = `http://ip-api.com/json/${isPrivate ? "" : ip}?fields=status,lat,lon,city`;
    const res = await fetch(url, { timeout: Number(process.env.GEOIP_API_TIMEOUT_MS) });
    const data = await res.json();
    if (data.status !== "success") return null;
    return { coordinates: [data.lon, data.lat], city: data.city };
  } catch {
    return null;
  }
};

const getIpDefaultRadius = () => Number(process.env.GEOIP_DEFAULT_RADIUS_METERS);

module.exports = { resolveCoordinatesFromIp, getIpDefaultRadius };
