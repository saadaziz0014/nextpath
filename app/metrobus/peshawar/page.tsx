import '../metrobus.css';
import BusSimulator from '@/app/components/BusSimulator';
export const metadata={title:'Peshawar BRT — Chamkani ↔ Karkhano Market | NextPath',description:'Drive the Zu Peshawar SR-02 stopping corridor with 30 stations, a green hybrid articulated bus and manual or automatic station stops.'};
export default function PeshawarBrtPage(){return <BusSimulator key="peshawar-brt" networkId="peshawar-brt"/>;}
