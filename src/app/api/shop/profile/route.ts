import { ensureBootstrapped } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin, formString, redirectTo, HttpError } from "@/lib/http";
import { saveShopProfile } from "@/lib/shop";

export async function POST(req: Request) {
  const form = await req.formData();
  try {
    assertSameOrigin(req);
    await ensureBootstrapped();
    const user = await getCurrentUser();
    if (!user) return redirectTo(req, "/login?next=/shop");
    saveShopProfile(getDb(), user.id, {
      shopName: formString(form, "shop_name"),
      choice: formString(form, "sub_industry"),
      city: formString(form, "city"),
      district: formString(form, "district"),
      avgSpend: formString(form, "avg_spend"),
      products: [formString(form, "product_1"), formString(form, "product_2"), formString(form, "product_3")],
      sellingPoints: String(form.get("selling_points") ?? ""),
      audience: formString(form, "audience"),
      tone: formString(form, "tone"),
      ownerOnCamera: formString(form, "owner_on_camera") === "yes",
    });
    return redirectTo(req, "/shop?ok=档案已保存");
  } catch (error) {
    const message = error instanceof HttpError ? error.message : error instanceof Error ? error.message : "保存失败";
    return redirectTo(req, `/shop?error=${encodeURIComponent(message)}`);
  }
}
