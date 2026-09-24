-- Create faculties table
CREATE TABLE faculties (
    fac_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fac_name TEXT NOT NULL
);

-- Create athletes table
CREATE TABLE athletes (
    athlete_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id TEXT UNIQUE,
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('M', 'F')),
    email TEXT,
    faculty_id INT REFERENCES faculties(fac_id),
    study_year INT
);

-- Create events table
CREATE TABLE events (
    event_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_name TEXT NOT NULL,
    distance_meters INT NOT NULL,
    gender TEXT CHECK (gender IN ('M', 'F', 'Mixed')),
    is_relay BOOLEAN DEFAULT FALSE
);

-- Create event_rounds table
CREATE TABLE event_rounds (
    round_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id INT REFERENCES events(event_id) ON DELETE CASCADE,
    round_name TEXT NOT NULL
);

-- Create relay_teams table
CREATE TABLE relay_teams (
    relay_team_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_name TEXT NOT NULL,
    faculty_id INT REFERENCES faculties(fac_id)
);

-- Create relay_members table
CREATE TABLE relay_members (
    relay_team_id INT REFERENCES relay_teams(relay_team_id) ON DELETE CASCADE,
    athlete_id INT REFERENCES athletes(athlete_id),
    leg_order SMALLINT CHECK (leg_order BETWEEN 1 AND 4),
    PRIMARY KEY (relay_team_id, athlete_id),
    UNIQUE (relay_team_id, leg_order)
);

-- Create race_results table
CREATE TABLE race_results (
    result_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    round_id INT REFERENCES event_rounds(round_id) ON DELETE CASCADE,
    lane_number SMALLINT NULL,
    athlete_id INT REFERENCES athletes(athlete_id) ON DELETE SET NULL,
    relay_team_id INT REFERENCES relay_teams(relay_team_id) ON DELETE SET NULL,
    record_time DECIMAL(6,2) NULL,
    rank INT NULL,
    status TEXT DEFAULT 'OK' CHECK (status IN ('OK', 'DNS', 'DNF', 'DQ')),
    wind_reading DECIMAL(3,1) NULL,
    UNIQUE (round_id, lane_number),
    CHECK ((athlete_id IS NOT NULL AND relay_team_id IS NULL) OR (athlete_id IS NULL AND relay_team_id IS NOT NULL))
);

-- Insert Seed Data for Events
INSERT INTO events (event_name, distance_meters, gender, is_relay) VALUES
    ('100 เมตร ชาย', 100, 'M', false),
    ('100 เมตร หญิง', 100, 'F', false),
    ('200 เมตร ชาย', 200, 'M', false),
    ('200 เมตร หญิง', 200, 'F', false),
    ('400 เมตร ชาย', 400, 'M', false),
    ('400 เมตร หญิง', 400, 'F', false),
    ('800 เมตร ชาย', 800, 'M', false),
    ('800 เมตร หญิง', 800, 'F', false),
    ('วิ่งผลัด 4x100 เมตร ชาย', 400, 'M', true),
    ('วิ่งผลัด 4x100 เมตร หญิง', 400, 'F', true),
    ('วิ่งผลัด 4x400 เมตร ผสม', 1600, 'Mixed', true);

-- Enable Row Level Security (RLS)
ALTER TABLE faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE relay_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE relay_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for development (You may want to restrict this later)
CREATE POLICY "Allow anonymous select on faculties" ON faculties FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on faculties" ON faculties FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on faculties" ON faculties FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on athletes" ON athletes FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on athletes" ON athletes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on athletes" ON athletes FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on events" ON events FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on events" ON events FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on event_rounds" ON event_rounds FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on event_rounds" ON event_rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on event_rounds" ON event_rounds FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on relay_teams" ON relay_teams FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on relay_teams" ON relay_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on relay_teams" ON relay_teams FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on relay_members" ON relay_members FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on relay_members" ON relay_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on relay_members" ON relay_members FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous select on race_results" ON race_results FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert on race_results" ON race_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update on race_results" ON race_results FOR UPDATE USING (true);

-- Enable Supabase Realtime for race_results
alter publication supabase_realtime add table race_results;
