CREATE TABLE events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    category VARCHAR(80) NULL,
    url VARCHAR(500) NULL,
    description TEXT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#00f5ff',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_events_start_date (start_date),
    INDEX idx_events_end_date (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE pageview_counter (
    visit_year SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
    views BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
