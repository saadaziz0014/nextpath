import './metrobus.css';
import BusSimulator from '@/app/components/BusSimulator';
export const metadata={title:'Lahore Metrobus — Shahdara ↔ Gajjumata | NextPath',description:'Drive the Lahore Metrobus corridor with 27 stations and a red articulated bus.'};
export default function MetrobusPage(){return <BusSimulator key="lahore-metrobus" networkId="lahore-metrobus"/>;}
