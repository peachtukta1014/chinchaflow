import { cartItemDisplayName } from '../lib/displayNames';

export default function CartSheet({
  open,
  onClose,
  cart,
  cartTotal,
  payType,
  setPayType,
  removeCart,
  updateCartQty,
  saving,
  onSave,
  t,
  lang = 'th',
  menuItems = [],
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-3xl p-5"
        style={{ paddingBottom: 'max(1.5rem,env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-black mb-3">{t('items')}</p>
        <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
          {cart.map((item) => {
            const { primary, sub } = cartItemDisplayName(item, lang, t, menuItems);
            return (
            <div key={item.cartId} className="flex justify-between text-sm gap-2">
              <span className="min-w-0">
                {item.emoji} {primary} ×{item.qty}
                {sub ? <span className="block text-[10px] text-stone-400">{sub}</span> : null}
              </span>
              <div className="flex gap-2 items-center shrink-0">
                <div className="flex items-center gap-1 rounded-xl border border-stone-200 px-1 py-0.5">
                  <button type="button" onClick={() => updateCartQty(item.cartId, item.qty - 1)} className="w-7 h-7 rounded-lg bg-stone-100 font-black">−</button>
                  <span className="w-6 text-center font-black">{item.qty}</span>
                  <button type="button" onClick={() => updateCartQty(item.cartId, item.qty + 1)} className="w-7 h-7 rounded-lg bg-stone-100 font-black">+</button>
                </div>
                <span className="font-black">฿{item.price * item.qty}</span>
                <button type="button" onClick={() => removeCart(item.cartId)} className="text-red-400 font-black">×</button>
              </div>
            </div>
          );})}
        </div>
        <div className="flex gap-2 mb-3">
          {[['cash', `💵 ${t('cash')}`], ['transfer', `📱 ${t('transfer')}`]].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setPayType(v)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 ${payType === v ? 'border-amber-400 bg-amber-50' : 'border-stone-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="w-full py-3 rounded-2xl font-black text-white"
          style={{ background: '#3d1f0f' }}
        >
          {saving ? '⏳' : t('save')}
        </button>
      </div>
    </div>
  );
}
