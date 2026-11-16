import { clearMembership, grantAnnualMembership, activateOrder, adjustCredits } from "@/lib/billing";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { inferCalendarYear } from "@/lib/cn-date";
import {
  createCase,
  createEvent,
  createIndustry,
  createTopic,
  deleteCase,
  deleteEvent,
  deleteIndustry,
  deleteTopic,
  importCalendarCsv,
  importTopicCsv,
  listIndustries,
  saveLegal,
  updateCase,
  updateEvent,
  updateIndustry,
  updateTopic,
} from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { todayShanghai } from "@/lib/dates";
import { assertSameOrigin, formString, redirectTo, safePath, HttpError } from "@/lib/http";
import { hideHotPitch, hideManualIdea, importHotIdeas } from "@/lib/hot";
import { createTopicCopy, deleteTopicCopy, importCopyCsv, parseWhy, updateTopicCopy } from "@/lib/copies";
import { importBenchmarkCsv } from "@/lib/benchmarks";
import { addForbiddenWord, disableForbiddenWord } from "@/lib/forbidden";
import { getUserById, updateUserAdmin } from "@/lib/auth";
import { clearPlan, grantPlan, isPlanSlug, setAiBeta, setPlanQuotas } from "@/lib/membership";
import type { HeatSource } from "@/lib/types";
import type { EventType, TopicStatus } from "@/lib/types";

export async function POST(req: Request) {
  const form = await req.formData();
  const action = formString(form, "action");
  const fallback = safePath(formString(form, "return_to"), "/admin");
  try {
    assertSameOrigin(req);
    await ensureBootstrapped();
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "admin") return redirectTo(req, "/login?next=/admin");
    const db = getDb();
    if (action === "create_topic" || action === "update_topic") {
      const input = {
        industryId: Number(formString(form, "industry_id")),
        title: formString(form, "title"),
        hook: formString(form, "hook"),
        platform: formString(form, "platform"),
        contentForm: formString(form, "content_form"),
        publishDate: formString(form, "publish_date"),
        sortOrder: Number(formString(form, "sort_order") || 0),
        note: formString(form, "note"),
        subIndustry: formString(form, "sub_industry"),
        difficulty: Number(formString(form, "difficulty") || 2),
        heatSource: (formString(form, "heat_source") || "常青") as HeatSource,
        shootMinutes: Number(formString(form, "shoot_minutes") || 0) || null,
        isSample: formString(form, "is_sample") === "yes",
        status: (formString(form, "status") === "draft" ? "draft" : "published") as TopicStatus,
      };
      if (action === "create_topic") createTopic(db, input);
      else updateTopic(db, Number(formString(form, "id")), input);
    } else if (action === "delete_topic") {
      deleteTopic(db, Number(formString(form, "id")));
    } else if (action === "import_topics") {
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 CSV 文件");
      if (file.size > 1_000_000) throw new Error("文件不能超过 1MB");
      const result = importTopicCsv(db, await file.text(), {
        defaultDate: formString(form, "publish_date") || todayShanghai(),
        isSample: formString(form, "is_sample") === "yes",
      });
      const message = `导入 ${result.imported} 条，跳过 ${result.skipped} 条${result.errors.length ? `。${result.errors.slice(0, 3).join("；")}` : ""}`;
      return redirectTo(req, `${fallback}?ok=${encodeURIComponent(message)}`);
    } else if (action === "create_event" || action === "update_event") {
      const industries = listIndustries(db);
      const directions = industries
        .map((industry) => ({ industryName: industry.name, direction: formString(form, `direction_${industry.id}`) }))
        .filter((item) => item.direction);
      const input = {
        dateLabel: formString(form, "date_label"),
        startDate: formString(form, "start_date") || null,
        endDate: formString(form, "end_date") || null,
        title: formString(form, "title"),
        prepLabel: formString(form, "prep_label"),
        caution: formString(form, "caution"),
        detail: formString(form, "detail"),
        eventType: (formString(form, "event_type") || undefined) as EventType | undefined,
        isSample: formString(form, "is_sample") === "yes",
        sortOrder: Number(formString(form, "sort_order") || 0),
        directions,
      };
      if (action === "create_event") createEvent(db, input);
      else updateEvent(db, Number(formString(form, "id")), input);
    } else if (action === "delete_event") {
      deleteEvent(db, Number(formString(form, "id")));
    } else if (action === "import_calendar") {
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 CSV 文件");
      if (file.size > 1_000_000) throw new Error("文件不能超过 1MB");
      const year = Number(formString(form, "base_year") || inferCalendarYear(todayShanghai()));
      const result = importCalendarCsv(db, await file.text(), {
        baseYear: year,
        isSample: formString(form, "is_sample") === "yes",
      });
      const message = `导入 ${result.imported} 条，跳过 ${result.skipped} 条${result.errors.length ? `。${result.errors.slice(0, 3).join("；")}` : ""}`;
      return redirectTo(req, `${fallback}?ok=${encodeURIComponent(message)}`);
    } else if (action === "create_case" || action === "update_case") {
      const industry = formString(form, "industry_id");
      const input = {
        title: formString(form, "title"),
        platform: formString(form, "platform"),
        industryId: industry ? Number(industry) : null,
        teaser: formString(form, "teaser"),
        body: String(form.get("body") ?? ""),
        publishedAt: formString(form, "published_at") || todayShanghai(),
        isSample: formString(form, "is_sample") === "yes",
      };
      if (action === "create_case") createCase(db, input);
      else updateCase(db, Number(formString(form, "id")), input);
    } else if (action === "delete_case") {
      deleteCase(db, Number(formString(form, "id")));
    } else if (action === "create_industry") {
      createIndustry(db, {
        name: formString(form, "name"),
        slug: formString(form, "slug"),
        color: formString(form, "color") || "#FF4F17",
        description: formString(form, "description"),
        sortOrder: Number(formString(form, "sort_order") || 0),
      });
    } else if (action === "update_industry") {
      updateIndustry(db, Number(formString(form, "id")), {
        name: formString(form, "name"),
        slug: formString(form, "slug"),
        color: formString(form, "color"),
        description: formString(form, "description"),
        sortOrder: Number(formString(form, "sort_order") || 0),
      });
    } else if (action === "delete_industry") {
      deleteIndustry(db, Number(formString(form, "id")));
    } else if (action === "update_user") {
      const userId = Number(formString(form, "id"));
      const before = getUserById(db, userId);
      const tier = formString(form, "tier") === "annual" ? "annual" : "free";
      updateUserAdmin(db, userId, {
        role: formString(form, "role") === "admin" ? "admin" : "user",
        creditDelta: Number(formString(form, "credit_delta") || 0),
      });
      if (tier === "annual" && before?.tier !== "annual") grantAnnualMembership(db, userId, 1);
      if (tier === "free" && before?.tier === "annual") clearMembership(db, userId);
      const plan = formString(form, "plan");
      if (plan === "free") clearPlan(db, userId);
      else if (isPlanSlug(plan) && plan !== "free") {
        const day = formString(form, "plan_expires");
        const expiry = /^\d{4}-\d{2}-\d{2}$/.test(day)
          ? new Date(`${day}T23:59:59+08:00`).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        grantPlan(db, userId, plan, expiry);
      }
      setAiBeta(db, userId, plan === "vip" || plan === "shop" || formString(form, "ai_beta") === "yes");
    } else if (action === "update_quotas") {
      setPlanQuotas(db, "free", {
        aiDaily: Number(formString(form, "free_ai")),
        copyUnlock: Number(formString(form, "free_copies")),
        forbiddenDaily: Number(formString(form, "free_forbidden")),
      });
      setPlanQuotas(db, "vip", {
        aiDaily: Number(formString(form, "vip_ai")),
        copyUnlock: -1,
        forbiddenDaily: -1,
      });
      setPlanQuotas(db, "shop", {
        aiDaily: Number(formString(form, "shop_ai")),
        copyUnlock: -1,
        forbiddenDaily: -1,
      });
    } else if (action === "create_copy") {
      createTopicCopy(db, {
        topicId: Number(formString(form, "topic_id")),
        styleLabel: formString(form, "style_label"),
        body: String(form.get("body") ?? ""),
        breakdown: parseWhy(String(form.get("why") ?? "")),
        storyboard: String(form.get("storyboard") ?? ""),
        status: formString(form, "status") === "draft" ? "draft" : "published",
      });
    } else if (action === "update_copy") {
      updateTopicCopy(db, Number(formString(form, "id")), {
        styleLabel: formString(form, "style_label"),
        body: String(form.get("body") ?? ""),
        breakdown: parseWhy(String(form.get("why") ?? "")),
        storyboard: String(form.get("storyboard") ?? ""),
        status: formString(form, "status") === "draft" ? "draft" : "published",
        sortOrder: Number(formString(form, "sort_order") || 0),
      });
    } else if (action === "delete_copy") {
      deleteTopicCopy(db, Number(formString(form, "id")));
    } else if (action === "hide_pitch") {
      hideHotPitch(db, Number(formString(form, "id")));
    } else if (action === "import_benchmarks") {
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 CSV 文件");
      if (file.size > 1_000_000) throw new Error("文件不能超过 1MB");
      const result = importBenchmarkCsv(db, await file.text());
      const message = `导入对标 ${result.imported} 条，跳过 ${result.skipped} 条${result.errors.length ? `。${result.errors.slice(0, 3).join("；")}` : ""}`;
      return redirectTo(req, `${fallback}?ok=${encodeURIComponent(message)}`);
    } else if (action === "import_hot_json") {
      const raw = String(form.get("json") ?? "");
      if (raw.length > 200_000) throw new Error("JSON 太大了");
      const result = importHotIdeas(db, JSON.parse(raw) as unknown);
      return redirectTo(req, `${fallback}?ok=${encodeURIComponent(`导入借势 ${result.imported} 条，跳过 ${result.skipped} 条`)}`);
    } else if (action === "hide_manual") {
      hideManualIdea(db, Number(formString(form, "id")));
    } else if (action === "add_forbidden") {
      addForbiddenWord(db, formString(form, "phrase"), formString(form, "replacement"), formString(form, "category"));
    } else if (action === "disable_forbidden") {
      disableForbiddenWord(db, Number(formString(form, "id")));
    } else if (action === "import_copies") {
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 CSV 文件");
      if (file.size > 1_000_000) throw new Error("文件不能超过 1MB");
      const result = importCopyCsv(db, await file.text());
      const message = `导入参考文案 ${result.imported} 条，跳过 ${result.skipped} 条${result.errors.length ? `。${result.errors.slice(0, 3).join("；")}` : ""}`;
      return redirectTo(req, `${fallback}?ok=${encodeURIComponent(message)}`);
    } else if (action === "activate_order") {
      activateOrder(db, formString(form, "order_no"), admin.id);
    } else if (action === "adjust_credits") {
      adjustCredits(db, Number(formString(form, "id")), Number(formString(form, "credit_delta") || 0), "管理员调整");
    } else if (action === "save_legal") {
      const slug = formString(form, "slug");
      if (slug !== "terms" && slug !== "privacy") throw new Error("未知文档");
      saveLegal(db, slug, formString(form, "title"), String(form.get("content") ?? ""));
    } else {
      throw new Error("未知操作");
    }
    return redirectTo(req, `${fallback}?ok=${encodeURIComponent("已保存")}`);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : error instanceof Error ? error.message : "操作失败";
    return redirectTo(req, `${fallback}?error=${encodeURIComponent(message)}`);
  }
}
