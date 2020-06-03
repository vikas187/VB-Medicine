const request = require('request');
const csvtojson = require('csvtojson');
const cheer = require('cheerio');
const ObjectsToCsv = require('objects-to-csv');

csvtojson()
.fromFile('./claims.csv')
.then(async jsonObj =>{
    for(let i=0;i<jsonObj.length;i++){
      const updateList = new Promise((resolve, reject)=>{
        let options = {
          'method': 'POST',
          'url': 'http://www.vahealthprovider.com/search_results.asp',
          'headers': {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': 'ASPSESSIONIDQSRCSCDS=BPOBAFNAEBFAKENCHNODPMAB'
          },
          form: {
            'last_Name': jsonObj[i].lastname,
            'county': 'Any',
            'speciality': 'Any',
            'Submit': 'Search'
          }
        };
        request(options, function (error, response) { 
          if (error) reject(error);
          body = response.body;
          let regex = /license_no/gi, result, indices = [], urls=[];
          while ( (result = regex.exec(body)) ) {
              indices.push(result.index);
          }
          indices.forEach((index)=>{
              let i=index;
              let str="";
              while(body.charAt(i)!='>') {
                  str += body[i];
                  i++;
              }
              urls.push(str);
          });
          console.log("urls count" +urls.length);
          //urls = urls.slice(0,1);
          //this code will be running in background
          const getDetailsArray = new Promise((resolve, reject)=>{
            let detailsArray=[];
            if(urls.length==0) {
              reject("No results found");
            }
            let count=0;
            urls.forEach(url=>{
              let options = {
                'method': 'GET',
                'url': `http://www.vahealthprovider.com/results_paid.asp?${url}`,
                'headers': {
                    'Cookie': 'ASPSESSIONIDQSRCSCDS=CIBCAFNAHOHEHHOAFMNPCGDB'
                }
              };
              request(options, function (error, response) { 
                if (error) reject(error);
                if(response.body) {
                    let html = response.body;
                    //console.log(html);
                    const name = html.substring(html.indexOf("Practitioner Name")+19, html.indexOf(",", html.indexOf("Practitioner Name")));
                    const tableIndex = html.indexOf("<Table");
                    const tableEndIndex = html.indexOf("</table>", tableIndex);
                    html = html.substring(tableIndex, tableEndIndex+8);
                    html = html.replace("Paid Claims in the last ten years", "");
                    html = html.replace("subtext", "note1");
                    html = html.replace("subtext", "note2");
                    let $ = cheer.load(html);
                    const note2 = $('#note2').text();
                    html = html.replace(note2, "");
                    $ = cheer.load(html);
                    let value3 = $('#resbox').text().trim();
                    count++;
                    if(value3.indexOf('Specialty') !== -1) {
                        let specialityIndex = [];
                        let regex = /Specialty/g, specialtyResult;
                        while ( (specialtyResult = regex.exec(value3)) ) {
                            specialityIndex.push(specialtyResult.index);
                        }
                        console.log(specialityIndex);
                        specialityIndex.forEach(index=>{
                            let i=index;
                            let obj={};
                            obj.specialty = "";
                            while(value3[i]!==':') {
                                i++;
                            }
                            i=i+1;
                            while(value3[i]!=='\n') {
                                obj.specialty += value3[i];
                                i++;
                            }
                            obj.location = "";
                            while(value3[i]!==':') {
                                i++;
                            }
                            i=i+1;
                            while(value3[i]!=='\n') {
                                obj.location += value3[i];
                                i++;
                            }
                            obj.year = "";
                            while(value3[i]!==':') {
                                i++;
                            }
                            i=i+1;
                            while(value3[i]!=='\n') {
                                obj.year += value3[i];
                                i++;
                            }
                            obj.amount = "";
                            while(value3[i]!==':') {
                                i++;
                            }
                            i=i+1;
                            while(value3[i]!=='\n') {
                                obj.amount += value3[i];
                                i++;
                            }
                            obj.comments = "";
                            
                            while(value3[i]!==':') {
                                i++;
                            }
                            i=i+1;
                            while(value3[i]!=='\n') {
                                obj.comments += value3[i];
                                i++;
                            }
                            console.log(name);
                            const details = {
                                "name": name,
                                "Liscene No": url,
                                ...obj
                            }
                            detailsArray.push(details);
                        });
                    } else {
                        // const details = {
                        //     "name": name,
                        //     "Liscene No": url,
                        //     "speciality": "",
                        //     "location": "",
                        //     "year": "",
                        //     "amount": "",
                        //     "comments": ""
                        // }
                        // detailsArray.push(details);
                    }
        
                    if(count===urls.length) {
                        resolve(detailsArray);
                    }
                }
              });
            });
          }).then((data)=>{
              console.log(data);
            const csv = new ObjectsToCsv(data);
            const saveCsv = async()=>{
              await csv.toDisk('./list1.csv', {append: true});
            }
            saveCsv().then(()=>resolve('File saved successfully')).catch((ex)=>reject(ex));
          }).catch(ex=>{
            reject(ex);
            return;
          });
        }); 
      }).then(data=>{
        console.log(data);
      }).catch(ex=>{
        console.log(ex);
      });

      await updateList;
    }   
});
