// ============================================================
//  Cloudflare Worker — Real IP Detector
//  Deploy di: workers.cloudflare.com
//  Endpoint: https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/ip
// ============================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Ambil IP asli visitor dari header Cloudflare
  const ip         = request.headers.get('CF-Connecting-IP')     || 'unknown'
  const country    = request.headers.get('CF-IPCountry')         || ''
  const region     = request.headers.get('CF-Region')            || ''
  const city       = request.headers.get('CF-IPCity')            || ''
  const timezone   = request.headers.get('CF-Timezone')          || ''
  const asn        = request.headers.get('CF-ASN')               || ''
  const isp        = request.headers.get('CF-ISP')               || ''
  const lat        = request.headers.get('CF-IPLatitude')        || ''
  const lon        = request.headers.get('CF-IPLongitude')       || ''
  const postalCode = request.headers.get('CF-PostalCode')        || ''
  const continent  = request.headers.get('CF-IPContinent')       || ''

  // Jika ada, lakukan lookup tambahan ke ip-api.com menggunakan IP asli
  let extraData = {}
  if (ip !== 'unknown') {
    try {
      const apiRes = await fetch(
        `https://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as`,
        { cf: { cacheEverything: true, cacheTtl: 300 } }
      )
      const apiJson = await apiRes.json()
      if (apiJson.status === 'success') {
        extraData = {
          isp_detail : apiJson.org || apiJson.isp || isp,
          asn_detail : apiJson.as  || (asn ? 'AS' + asn : ''),
          city_detail: apiJson.city       || city,
          region_detail: apiJson.regionName || region,
          country_detail: apiJson.country  || '',
          country_code: apiJson.countryCode || country,
          zip_detail : apiJson.zip        || postalCode,
          lat_detail : apiJson.lat        || lat,
          lon_detail : apiJson.lon        || lon,
          tz_detail  : apiJson.timezone   || timezone,
        }
      }
    } catch (e) {
      // Fallback ke CF headers saja jika ip-api gagal
      extraData = {
        isp_detail    : isp,
        asn_detail    : asn ? 'AS' + asn : '',
        city_detail   : city,
        region_detail : region,
        country_detail: '',
        country_code  : country,
        zip_detail    : postalCode,
        lat_detail    : lat,
        lon_detail    : lon,
        tz_detail     : timezone,
      }
    }
  }

  const payload = {
    ip,
    continent,
    country_code    : extraData.country_code  || country,
    country         : extraData.country_detail|| '',
    region          : extraData.region_detail || region,
    city            : extraData.city_detail   || city,
    zip             : extraData.zip_detail    || postalCode,
    lat             : extraData.lat_detail    || lat,
    lon             : extraData.lon_detail    || lon,
    timezone        : extraData.tz_detail     || timezone,
    isp             : extraData.isp_detail    || isp,
    asn             : extraData.asn_detail    || (asn ? 'AS' + asn : ''),
    source          : 'cloudflare-worker',
  }

  // CORS — izinkan dipanggil dari domain Cloudflare Pages kamu
  // Ganti YOUR-SITE.pages.dev dengan domain asli kamu
  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = [
    'https://YOUR-SITE.pages.dev',   // ← GANTI INI
    'http://localhost',
    'http://127.0.0.1',
    'null', // file:// lokal
  ]

  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type'                : 'application/json',
      'Access-Control-Allow-Origin' : corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control'               : 'no-store',
    }
  })
}
