-- Preserve unsuccessful checkout attempts without blocking a new reservation.
ALTER TABLE public."BusinessPlanPayment" DROP CONSTRAINT "BusinessPlanPayment_status_check", ADD CONSTRAINT "BusinessPlanPayment_status_check" CHECK(status IN ('creating','created','captured','refunded','failed'));
