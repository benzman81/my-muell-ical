const ical = require('ical-generator');
const http = require('http');
const moment= require('moment');
const url = require('url');
const request = require('request');
const awaitRequest = async (value) =>
new Promise((resolve, reject) => {
  request(value, (error, response, data) => {
      if(error) reject(error)
      else resolve(data)
  })
});

const respondWithError = function(response, errorMsg) {
  response.statusCode = 404;
  response.setHeader("Content-Type", "text/plain");
  response.write(errorMsg);
  response.end();
};

const BASE_URL = 'https://mymuell.jumomind.com/';
const PORT = process.env.PORT || 3000;

http.createServer(async function(request, response) {
  const theUrl = request.url;
  const theUrlParts = url.parse(theUrl, true);
  const theUrlParams = theUrlParts.query;

  if (!theUrlParams.city_id) {
    respondWithError(response, "No city_id in request.");
    return;
  }

  if (!theUrlParams.area_id) {
    respondWithError(response, "No area_id in request.");
    return;
  }

  try {
    const resultTrashTypesArray = await awaitRequest({
        uri: 'mmapp/api.php?r=trash&city_id='+theUrlParams.city_id,
        baseUrl: BASE_URL,
        json: true
    });

    const resultTrashTypes = {};
    resultTrashTypesArray.forEach(function(item){
      resultTrashTypes[item.name] = item.title;
    });

    const resultData = await awaitRequest({
        uri: 'webservice.php?idx=termins&city_id='+theUrlParams.city_id+'&area_id='+theUrlParams.area_id+'&ws=3',
        baseUrl: BASE_URL,
        json: true
    });
    if(resultData.length < 1 || resultData[0].Ack !== 'Success' || !resultData[0]._data || resultData[0]._data.length < 1) {
      throw new Error("Request of data has invalid result.");
    }

    const events = [];
    resultData[0]._data.forEach(function(item){
      events.push({
        start: moment(item.cal_date, 'YYYY-MM-DD'),
        allDay: true,
        summary: resultTrashTypes[item.cal_garbage_type]
      });
    });

    const cal = ical({domain: 'playershouse.com', name: 'Abfallkalender'}).timezone('Europe/Berlin');
    cal.events(events);
    cal.serve(response);
  }
  catch (err) {
    console.error(err);
    respondWithError(response, err.message);
  }
}).listen(PORT, '0.0.0.0', function() {
    console.log('Server running at http://127.0.0.1:'+PORT+'/');
});