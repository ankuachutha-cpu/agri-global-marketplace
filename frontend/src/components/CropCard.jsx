import { Link } from 'react-router-dom';
import { imgUrl } from '../services/api.js';
import { useCurrency } from '../context/CurrencyContext.jsx';
export default function CropCard({ crop }) {
  const { format } = useCurrency(); const p = format(crop.priceInr);
  return (
    <Link to={`/crops/${crop._id}`} className="card block overflow-hidden p-0 transition hover:shadow-md">
      <div className="flex h-40 items-center justify-center bg-leaf-50 text-5xl relative">
        {crop.images?.[0] ? <img src={imgUrl(crop.images[0])} alt={crop.name} loading="lazy" className="h-full w-full object-cover" /> : '🌱'}
        {crop.organicCertified && (
          <span className="absolute top-2 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            🌿 Organic
          </span>
        )}
        {crop.grade && (
          <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            Grade {crop.grade}
          </span>
        )}
      </div>
      <div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{crop.name}</h3><span className="rounded bg-leaf-100 px-2 py-0.5 text-xs text-leaf-700">{crop.category}</span></div>
        <p className="mt-1 text-lg font-bold text-leaf-700">{p.text}<span className="text-xs font-normal text-stone-500"> / {crop.unit}</span></p>
        {p.converted && <p className="text-xs text-stone-400">≈ ₹{crop.priceInr} / {crop.unit} original</p>}
        <p className="mt-1 text-xs text-stone-500">📍 {crop.location}{crop.state ? `, ${crop.state}` : ''} · {crop.quantity} {crop.unit} available</p></div>
    </Link>
  );
}
