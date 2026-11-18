<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    protected AnalyticsService $analyticsService;

    public function __construct(AnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    /**
     * Compute comprehensive multi-dimensional productivity analytics.
     */
    public function productivity(Request $request)
    {
        $data = $this->analyticsService->getProductivityAnalytics($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Compute comprehensive learning & examination analytics.
     */
    public function learning(Request $request)
    {
        $data = $this->analyticsService->getLearningAnalytics($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Authoritative, tenant-isolated CSV data export.
     */
    public function export(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:productivity,tasks,projects,learning,exams',
            'range' => 'nullable|string|in:today,this_week,this_month,last_30_days,custom',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'project_id' => 'nullable|integer',
            'course_id' => 'nullable|integer',
        ]);

        $type = $validated['type'];
        $csvData = $this->analyticsService->exportCsv($request->user(), $type, $request->all());
        $filename = "tuntas-{$type}-report-" . date('Y-m-d') . ".csv";

        return response($csvData, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
