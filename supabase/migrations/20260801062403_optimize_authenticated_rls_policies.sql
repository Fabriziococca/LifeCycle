-- Evaluate auth.uid() once per statement so RLS remains efficient as data grows.
alter policy "Users can only read/write their own data"
on public.user_data
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy "Users can manage their own subscriptions"
on public.push_subscriptions
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
