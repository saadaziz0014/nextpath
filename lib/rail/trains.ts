import type { RailDataset, RailPath } from './types';
import { reversePath } from './track';

/** Train definitions are separate from track geometry. Future trains can reuse
 * corridors while supplying their own direction and stopping pattern. */
export interface TrainService {
  id: string;
  number: string;
  direction: 'Up' | 'Down';
  reverse: boolean;
  stopNames: readonly string[];
}
export interface TrainDefinition {
  id: string;
  name: string;
  pathId: RailPath['id'];
  researchedOn: string;
  via: string;
  note?: string;
  sources: readonly string[];
  services: readonly TrainService[];
}
const upStops = [
  'Karachi Cantonment','Drigh Road','Landhi','Kotri','Hyderabad','Tando Adam',
  'Nawabshah','Bhiria Road','Mehrabpur','Gambat','Rohri','Ghotki','Sadiqabad',
  'Rahim Yar Khan','Khanpur','Bahawalpur','Lodhran','Dunyapur','Jahanian',
  'Khanewal','Mian Channu','Chichawatni','Sahiwal','Okara','Pattoki',
  'Kot Radha Kishan','Raiwind','Kot Lakhpat','Lahore Junction',
  'Shahdara Bagh Junction','Narang Mandi','Baddomalhi','Narowal Junction',
  'Kila Sobha Singh','Pasrur','Chawinda','Sialkot',
] as const;
const fareedUpStops = [
  'Karachi City','Karachi Cantonment','Drigh Road','Landhi','Kotri','Hyderabad',
  'Tando Adam','Shahdadpur','Nawabshah','Padidan','Bhiria Road','Mehrabpur',
  'Rohri','Ghotki','Mirpur Mathelo','Sadiqabad','Rahim Yar Khan','Khanpur',
  'Liaquatpur','Dera Nawab Sahib','Mubarakpur','Samasata','Bahawalpur','Lodhran',
  'Jamraniwah','Kahror Pakka','Mailsi','Nur Shah','Vehari','Machhianwala',
  'Mandi Burewala','Gagoo','Arifwala','Murad Chishti','Pakpattan',
  'Haveli Wasawewala','Basirpur','Mandi Ahmadabad','Kanganpur','Usmanwala',
  'Khudian','Kasur','Raiwind','Kot Lakhpat','Lahore Junction',
] as const;
const jaffarUpStops = [
  'Quetta','Kolpur','Mach','Ab-i-gum','Sibi',
  'Bakhtiarabad Domki','Dera Murad Jamali','Dera Allahyar','Jacobabad','Shikarpur',
  'Sukkur','Rohri','Pano Aqil','Ghotki','Sadiqabad',
  'Rahim Yar Khan','Khanpur','Bahawalpur','Multan Cantt','Khanewal',
  'Mian Channu','Chichawatni','Sahiwal','Okara','Pattoki',
  'Raiwind','Kot Lakhpat','Lahore Cantonment','Lahore Junction','Gujranwala',
  'Wazirabad','Gujrat','Lala Musa','Kharian','Jhelum',
  'Gujar Khan','Rawalpindi','Attock City','Jehangira Road','Nowshera',
  'Peshawar City','Peshawar Cantonment',
] as const;
// The two published Awam profiles have the same 62 stops in reverse order.
// Keep this list separate from other trains sharing ML-1.
const awamStops = [
  'Karachi Cantonment','Drigh Road','Landhi','Bin Qasim','Kotri','Hyderabad',
  'Tando Adam','Shahdadpur','Sarhari','Nawabshah','Daur','Bandhi','Kot Laloo',
  'Padidan','Bhiria Road','Mehrabpur','Setharja','Ranipur Riyasat','Gambat',
  'Khairpur','Rohri','Pano Aqil','Ghotki','Mirpur Mathelo','Daharki',
  'Sadiqabad','Rahim Yar Khan','Khanpur','Liaquatpur','Dera Nawab Sahib',
  'Samasata','Bahawalpur','Lodhran','Shujabad','Multan Cantt','Khanewal',
  'Mian Channu','Chichawatni','Sahiwal','Okara','Pattoki','Kot Radha Kishan',
  'Raiwind','Kot Lakhpat','Lahore Cantonment','Lahore Junction','Gujranwala',
  'Wazirabad','Gujrat','Lala Musa','Jhelum','Dina','Gujar Khan','Rawalpindi',
  'Golra Sharif','Taxila','Hasan Abdal','Attock City','Jehangira Road',
  'Nowshera','Peshawar City','Peshawar Cantonment',
] as const;
// Published Tezgam 7 Up pattern. Down adds two Karachi-area stops.
const tezgamStops = [
  'Karachi Cantonment','Hyderabad','Tando Adam','Shahdadpur','Nawabshah',
  'Mehrabpur','Khairpur','Rohri','Ghotki','Rahim Yar Khan','Khanpur',
  'Bahawalpur','Multan Cantt','Khanewal','Mian Channu','Chichawatni',
  'Sahiwal','Okara','Pattoki','Raiwind','Lahore Junction','Gujranwala',
  'Wazirabad','Gujrat','Lala Musa','Jhelum','Gujar Khan','Chaklala','Rawalpindi',
] as const;
const mohenjoDaroStops = [
  'Kotri','Sindh University','Cadet College Petaro','Amri','Laki Shah Saddar',
  'Sehwan Sharif','Bhan Sayadabad','Dadu','Phulji','Piaro Goth','Rehmani Nagar',
  'Balishah','Radhan','Sihar','Badah','Mohenjo Daro','Bakrani Road','Larkana',
  'Shah Nawaz Bhutto','Madeji Road','Ruk','Habib Kot','Sukkur','Rohri',
] as const;
// Published 17 Up profile; 18 Down additionally calls at Landhi.
const millatStops = [
  'Karachi Cantonment','Drigh Road','Hyderabad','Shahdadpur','Nawabshah',
  'Daur','Bandhi','Bhiria Road','Mehrabpur','Rohri','Sadiqabad',
  'Rahim Yar Khan','Khanpur','Bahawalpur','Lodhran','Dunyapur','Jahanian',
  'Khanewal','Abdul Hakim','Shorkot Cantt','Toba Tek Singh','Gojra',
  'Faisalabad','Chak Jhumra','Chiniot','Chenab Nagar','Shaheenabad',
  'Sargodha','Bhalwal','Phularwan','Malakwal','Mandi Bahauddin',
  'Chilian Wala','Dinga','Lala Musa',
] as const;
export const TRAINS: readonly TrainDefinition[] = [{
  id: 'allama-iqbal-express', name: 'Allama Iqbal Express', pathId: 'allama-iqbal',
  researchedOn: '2026-10-08', via: 'Jahanian & Narowal',
  sources: [
    'https://www.app.com.pk/national/railways-announces-temporary-stops-for-trains-at-different-stations/',
    'https://tracktrain.pk/trains/allama-iqbal-express-9up',
    'https://tracktrain.pk/trains/allama-iqbal-express-10dn',
  ],
  services: [
    { id: 'allama-iqbal-9-up', number: '9', direction: 'Up', reverse: false, stopNames: upStops },
    // Published Down profile excludes Gambat: do not simply reverse Up stops.
    { id: 'allama-iqbal-10-down', number: '10', direction: 'Down', reverse: true,
      stopNames: [...upStops].reverse().filter(name => name !== 'Gambat') },
  ],
}, {
  id: 'musa-pak-express', name: 'Musa Pak Express', pathId: 'musa-pak',
  researchedOn: '2026-10-08', via: 'Khanewal & Sahiwal',
  sources: [
    'https://bookme.pk/musa-pak-express',
    'https://traintracking.pk/trains/musa-pak-express-115up',
    'https://tracktrain.pk/trains/musa-pak-express-116dn',
    'https://railwaystations.pk/search-by-train/116dn-musa-pak-express/',
  ],
  services: [
    { id: 'musa-pak-115-up', number: '115', direction: 'Up', reverse: false,
      stopNames: ['Multan Cantt','Khanewal','Mian Channu','Chichawatni','Sahiwal','Okara','Pattoki','Raiwind','Kot Lakhpat','Lahore Junction'] },
    // Bookme and TrackTrain agree on six Down stops. A different directory
    // adds Chichawatni; the research document records this uncertainty.
    { id: 'musa-pak-116-down', number: '116', direction: 'Down', reverse: true,
      stopNames: ['Lahore Junction','Raiwind','Okara','Sahiwal','Khanewal','Multan Cantt'] },
  ],
}, {
  id: 'baba-farid-express', name: 'Baba Farid (Fareed) Express', pathId: 'fareed',
  researchedOn: '2026-10-08', via: 'Vehari, Pakpattan & Kasur',
  sources: [
    'https://tracktrain.pk/trains/fareed-express-37up',
    'https://tracktrain.pk/trains/fareed-express-38dn',
    'https://railwaystations.pk/search-by-train/37up-fareed-express/',
  ],
  services: [
    { id: 'fareed-37-up', number: '37', direction: 'Up', reverse: false, stopNames: fareedUpStops },
    // Down has a published Walton stop that is absent from Up.
    { id: 'fareed-38-down', number: '38', direction: 'Down', reverse: true,
      stopNames: ['Lahore Junction','Walton', ...fareedUpStops.slice(0, -1).reverse()] },
  ],
}, {
  id: 'jaffar-express', name: 'Jaffar Express', pathId: 'jaffar',
  researchedOn: '2026-10-08', via: 'Bolan Pass, Sukkur, Multan & Rawalpindi',
  note: 'Full Quetta–Peshawar simulation. Current operating pattern is unverified; Jacobabad is also available as a starting station.',
  sources: ['https://www.senate.gov.pk/uploads/documents/questions/1755574483_850.pdf','https://bookme.pk/jaffar-express'],
  services: [
    {id:'jaffar-39-up',number:'39',direction:'Up',reverse:false,stopNames:jaffarUpStops},
    // Bookme Down omits both Kot Lakhpat and Khanpur, unlike its Up table.
    {id:'jaffar-40-down',number:'40',direction:'Down',reverse:true,stopNames:[...jaffarUpStops].reverse().filter(name=>name!=='Kot Lakhpat' && name!=='Khanpur')},
  ],
}, {
  id: 'green-line-express', name: 'Green Line Express', pathId: 'green-line',
  researchedOn: '2026-10-08', via: 'Jahanian chord, Lahore & Rawalpindi',
  sources: ['https://traintracking.pk/trains/green-line-5up','https://traintracking.pk/trains/green-line-6dn'],
  services: [
    {id:'green-line-5-up',number:'5',direction:'Up',reverse:false,
      stopNames:['Karachi Cantonment','Hyderabad','Rohri','Bahawalpur','Khanewal','Lahore Junction','Chaklala','Rawalpindi','Margalla']},
    // Down additionally calls at Drigh Road; keep the direction-specific list.
    {id:'green-line-6-down',number:'6',direction:'Down',reverse:true,
      stopNames:['Margalla','Rawalpindi','Chaklala','Lahore Junction','Khanewal','Bahawalpur','Rohri','Hyderabad','Drigh Road','Karachi Cantonment']},
  ],
}, {
  id:'awam-express',name:'Awam Express',pathId:'awam',
  researchedOn:'2026-10-08',via:'Shujabad, Multan, Lahore & Rawalpindi',
  sources:['https://trains.metro-status.com/timetable/awam-express/','https://trains.metro-status.com/timetable/awam-express-14dn/'],
  services:[
    {id:'awam-13-up',number:'13',direction:'Up',reverse:false,stopNames:awamStops},
    {id:'awam-14-down',number:'14',direction:'Down',reverse:true,stopNames:[...awamStops].reverse()},
  ],
}, {
  id:'pak-business-express',name:'Pak Business Express',pathId:'pak-business',
  researchedOn:'2026-10-08',via:'Jahanian chord & Sahiwal',
  sources:['https://trains.metro-status.com/timetable/pak-business/','https://traintracking.pk/trains/pak-business-34dn'],
  services:[
    {id:'pak-business-33-up',number:'33',direction:'Up',reverse:false,
      stopNames:['Karachi Cantonment','Hyderabad','Nawabshah','Rohri','Rahim Yar Khan','Bahawalpur','Khanewal','Sahiwal','Raiwind','Kot Lakhpat','Lahore Junction']},
    // Down calls additionally at Landhi and Drigh Road, close to Karachi.
    {id:'pak-business-34-down',number:'34',direction:'Down',reverse:true,
      stopNames:['Lahore Junction','Kot Lakhpat','Raiwind','Sahiwal','Khanewal','Bahawalpur','Rahim Yar Khan','Rohri','Nawabshah','Hyderabad','Landhi','Drigh Road','Karachi Cantonment']},
  ],
}, {
  id:'subak-kharam',name:'Subak Kharam (Railcar)',pathId:'subak-kharam',
  researchedOn:'2026-10-08',via:'Gujranwala, Wazirabad & Jhelum',
  sources:['https://trains.metro-status.com/timetable/subak-kharam/','https://traintracking.pk/trains/subak-kharam-104dn'],
  services:[
    {id:'subak-kharam-103-up',number:'103',direction:'Up',reverse:false,
      stopNames:['Lahore Junction','Gujranwala','Wazirabad','Gujrat','Lala Musa','Jhelum','Chaklala','Rawalpindi']},
    // The published Down profile additionally calls at Gujar Khan.
    {id:'subak-kharam-104-down',number:'104',direction:'Down',reverse:true,
      stopNames:['Rawalpindi','Chaklala','Gujar Khan','Jhelum','Lala Musa','Gujrat','Wazirabad','Gujranwala','Lahore Junction']},
  ],
}, {
  id:'tezgam-express',name:'Tezgam Express',pathId:'tezgam',
  researchedOn:'2026-10-09',via:'Multan, Lahore & Jhelum',
  sources:['https://traintracking.pk/trains/tezgam-7up','https://traintracking.pk/trains/tezgam-8dn'],
  services:[
    {id:'tezgam-7-up',number:'7',direction:'Up',reverse:false,stopNames:tezgamStops},
    {id:'tezgam-8-down',number:'8',direction:'Down',reverse:true,
      stopNames:[...[...tezgamStops.slice(1)].reverse(),'Landhi','Drigh Road','Karachi Cantonment']},
  ],
}, {
  id:'mohenjo-daro-passenger',name:'Mohenjo Daro Express (Passenger)',pathId:'mohenjo-daro',
  researchedOn:'2026-10-09',via:'Sehwan, Dadu, Larkana & Habib Kot',
  note:'Historical Kotri–Rohri profile. Later extensions and suspension are reported; current operating timetable is unverified. Brake and confirm the Habib Kot direction change.',
  sources:['https://www.app.com.pk/domestic/moen-jo-daro-express-restored/','https://trains.metro-status.com/timetable/mohinjo-daro-passenger/','https://railwaystations.pk/search-by-train/214dn-mohinjo-daro-passenger/'],
  services:[
    {id:'mohenjo-daro-213-up',number:'213',direction:'Up',reverse:false,stopNames:mohenjoDaroStops},
    {id:'mohenjo-daro-214-down',number:'214',direction:'Down',reverse:true,stopNames:[...mohenjoDaroStops].reverse()},
  ],
}, {
  id:'millat-express',name:'Millat Express',pathId:'millat',
  researchedOn:'2026-10-09',via:'Jahanian, Faisalabad, Sargodha & Malakwal',
  sources:['https://traintracking.pk/trains/millat-express-17up','https://traintracking.pk/trains/millat-express-18dn','https://trains.metro-status.com/timetable/millat-express/'],
  services:[
    {id:'millat-17-up',number:'17',direction:'Up',reverse:false,stopNames:millatStops},
    // Keep direction-specific calls instead of assuming exact symmetry.
    {id:'millat-18-down',number:'18',direction:'Down',reverse:true,
      stopNames:[...[...millatStops.slice(2)].reverse(),'Landhi','Drigh Road','Karachi Cantonment']},
  ],
}, {
  id:'jamalo-express',name:'Jamalo Express (Ho Jamalo)',pathId:'jamalo',
  researchedOn:'2026-10-09',via:'Sukkur & the Indus railway crossing',
  note:'Reported Shikarpur extension. This simulation includes Shikarpur, Sukkur and Rohri; official service numbers and other station calls are unverified.',
  sources:[
    'https://www.radio.gov.pk/09-06-2026/sindh-govt-pakistan-railways-to-launch-jamalo-train-between-sukkur-to-rohri-before-muharam',
    'https://propakistani.pk/2026/05/26/new-train-service-to-launch-between-two-major-cities/',
    'https://urdu.arynews.tv/train-going-from-sukkur-to-shikarpur-collides-with-car-3-7-2026/',
  ],
  services:[
    // Local is a display label, not an invented Pakistan Railways train number.
    // Up follows the existing ML-3 convention toward Rohri; these are
    // simulation directions until an official Jamalo timetable is available.
    {id:'jamalo-local-up',number:'Local',direction:'Up',reverse:false,
      stopNames:['Shikarpur','Sukkur','Rohri']},
    {id:'jamalo-local-down',number:'Local',direction:'Down',reverse:true,
      stopNames:['Rohri','Sukkur','Shikarpur']},
  ],
}, {
  id:'karachi-circular-railway',name:'Karachi Circular Railway (Local)',pathId:'kcr',
  researchedOn:'2026-10-09',via:'Karachi City, Malir & Landhi to Dhabeji',
  note:'Shorter revived-service corridor simulation: Karachi City–Dhabeji, excluding Orangi and the historic loop. 11 mapped stops; Departure Yard, Drigh Colony and Pipri halt await verified locations. Current timetable and operation are unverified.',
  sources:[
    'https://www.radio.gov.pk/19-11-2020/railways-minister-inaugurates-kcr-at-city-station-karachi',
    'https://tracktrain.pk/trains/karachi-circular-railway-1up',
    'https://tracktrain.pk/trains/karachi-circular-railway-2dn',
    'https://radio.gov.pk/22-04-2026/pakistan-railways-sindh-govt-agree-to-restore-karachi-circular-railway',
  ],
  services:[
    // Published profile titles use 1 Up / 2 Down, while their database fields
    // say 229/230. Use the titles, without claiming verified service numbers.
    {id:'kcr-local-1-up',number:'1',direction:'Up',reverse:false,
      stopNames:['Karachi City','Karachi Cantonment','Drigh Road','Airport','Malir Colony','Malir','Landhi','Jumma Goth','Bin Qasim','Badal Nala','Dhabeji']},
    // The Down profile continues to Orangi. Deliberately trim that extension
    // to the same shorter local corridor selected by the user.
    {id:'kcr-local-2-down',number:'2',direction:'Down',reverse:true,
      stopNames:['Dhabeji','Badal Nala','Bin Qasim','Jumma Goth','Landhi','Malir','Malir Colony','Airport','Drigh Road','Karachi Cantonment','Karachi City']},
  ],
}];
const aliases: Record<string, RegExp> = {
  'Abdul Hakim': /^abdul hakim railway station$/i,
  'Shorkot Cantt': /^shorkot cantt junction railway station$/i,
  'Toba Tek Singh': /^toba tek singh railway station$/i,
  'Gojra': /^gojra railway station$/i,
  'Faisalabad': /^faisalabad(?: railway station)?$/i,
  'Chak Jhumra': /^chak jhumra junction railway station$/i,
  'Chilian Wala': /^chailianwala$/i,
  'Cadet College Petaro': /^petaro$/i,
  'Mohenjo Daro': /^mohenjo-daro$/i,
  'Bhan Sayadabad': /^bhan syedabad$/i,
  'Habib Kot': /^habib kot junction$/i,
  'Kot Laloo': /^kot lalloo$/i, 'Golra Sharif': /^golra sharif/i,
  'Hasan Abdal': /hasan abdal$/i,
  'Margalla': /^margalla railway station$/i,
  'Quetta': /^quetta$/i, 'Sibi': /^sibi junction$/i,
  'Ab-i-gum': /^aab-e-gum$/i, 'Jacobabad': /^jacobabad/i,
  'Shikarpur': /^shikarpur$/i, 'Sukkur': /^sukkur/i, 'Bakhtiarabad Domki': /^b[au]khtiar/i,
  'Dera Murad Jamali': /^dera murad/i, 'Dera Allahyar': /^dera allah/i,
  'Pano Aqil': /^pano a[kq]il/i, 'Wazirabad': /^wazirabad/i,
  'Lala Musa': /^lala musa/i, 'Rawalpindi': /^rawalpindi/i,
  'Attock City': /^attock city/i, 'Jehangira Road': /^jehangira$/i,
  'Nowshera': /^nowshera/i,
  'Karachi City': /^karachi city/i,
  'Liaquatpur': /^liaquat.?pur/i, 'Samasata': /^samasata/i, 'Vehari': /^v[ei]hari/i,
  'Machhianwala': /^mach(h?ianwala)?$/i, 'Arifwala': /^arif.?wala/i,
  'Pakpattan': /^pak.?pattan/i, 'Basirpur': /^basi[pr]pur|^basirpur/i,
  'Kasur': /^kasur(?: junction)?$/i, 'Mandi Burewala': /^mandi.*burewala/i,
  'Khudian': /^khudian/i, 'Jamraniwah': /^jamrani/i, 'Mandi Ahmadabad': /^mandi ahm[ae]d.?abad/i,
  'Multan Cantt': /^multan.*(cant|canton)/i,
  'Karachi Cantonment': /karachi.*canton/i, 'Landhi': /^landhi/i,
  'Kotri': /^kotri/i, 'Hyderabad': /^hyderabad/i, 'Nawabshah': /^nawabshah/i,
  'Mehrabpur': /^mehrabpur/i, 'Rohri': /^rohri/i, 'Khanpur': /^khanpur/i,
  'Lodhran': /^lodhran/i, 'Khanewal': /^khanewal/i,
  'Mian Channu': /^mian.*chan/i, 'Kot Radha Kishan': /^kot radha kish[ae]n/i,
  'Raiwind': /^raiwind/i, 'Jahanian': /^j[ae]han/i,
};
/** Fail closed on missing/ambiguous stops or incorrect order, rather than
 * silently dropping a station or snapping it to an unrelated railway. */
export function servicePath(dataset: RailDataset, train: TrainDefinition, service: TrainService): RailPath {
  if (!train.services.some(item => item.id === service.id)) throw new Error('Service does not belong to this train.');
  const source = dataset.paths.find(path => path.id === train.pathId);
  if (!source) throw new Error(`Missing track for ${train.name}.`);
  const directed = service.reverse ? reversePath(source) : source;
  let previous = -1;
  const stations = service.stopNames.map(name => {
    // Gujranwala has two OSM station features along this corridor. The
    // traditional city station is explicitly identified, never chosen by order.
    const matches = directed.stations.filter(station => name === 'Gujranwala' ? station.id === '2433331678' : aliases[name]?.test(station.name) ?? station.name.toLowerCase() === name.toLowerCase());
    if (matches.length !== 1) throw new Error(`Expected one mapped stop for ${name}, found ${matches.length}.`);
    const station = matches[0];
    if (station.km <= previous) throw new Error(`Service stop out of order: ${name}.`);
    previous = station.km;
    return station;
  });
  return { ...directed, name: `${train.name} · ${service.number} ${service.direction}`, stations };
}
