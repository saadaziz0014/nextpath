import '../metrobus.css';
import BusSimulator from '@/app/components/BusSimulator';
export const metadata={title:'Multan Metrobus — BZU ↔ Chowk Kumharan | NextPath',description:'Drive the Multan Red Line in both directions with 21 stations, selectable starts and manual or automatic station stops.'};
export default function MultanMetrobusPage(){return <BusSimulator key="multan-metrobus" networkId="multan-metrobus"/>;}
