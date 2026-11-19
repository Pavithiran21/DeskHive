package com.deskhive.job;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** The summary of one job run: counts only, never an email address, a name or a reason. */
@Entity
@Table(name = "job_runs")
public class JobRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "run_id", nullable = false, length = 36)
    private String runId;

    @Column(nullable = false, length = 10)
    private String job;

    @Column(name = "trigger_type", nullable = false, length = 10)
    private String triggerType;

    @Column(nullable = false, length = 10)
    private String status;

    /** The moment the run worked for: real time, or the simulated time given to the job endpoint. */
    @Column(name = "as_of", nullable = false)
    private Instant asOf;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "bookings_seen", nullable = false)
    private int bookingsSeen;

    @Column(name = "bookings_done", nullable = false)
    private int bookingsDone;

    @Column(nullable = false)
    private int skipped;

    protected JobRun() {
    }

    public static JobRun start(String runId, String job, String triggerType, Instant asOf, Instant startedAt) {
        JobRun run = new JobRun();
        run.runId = runId;
        run.job = job;
        run.triggerType = triggerType;
        run.status = "RUNNING";
        run.asOf = asOf;
        run.startedAt = startedAt;
        return run;
    }

    public void finish(String finalStatus, JobRunSummary counts, Instant finishedAt) {
        this.status = finalStatus;
        this.finishedAt = finishedAt;
        this.bookingsSeen = counts.bookingsSeen();
        this.bookingsDone = counts.bookingsDone();
        this.skipped = counts.skipped();
    }
}
