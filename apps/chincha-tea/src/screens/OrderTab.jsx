useEffect(() => {
  const unsubscribe = fsQueryOrders({
    onUpdate: (orders) => setOrders(orders),
    dateKey: dateKeyBangkok()
  });
  return () => unsubscribe();
}, [dateKeyBangkok()]);