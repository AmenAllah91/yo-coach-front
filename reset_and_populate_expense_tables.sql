-- Drop existing tables (in correct order due to foreign key)
DROP TABLE IF EXISTS Depense;
DROP TABLE IF EXISTS CategorieDepense;

-- Recreate CategorieDepense table with auto-increment
CREATE TABLE CategorieDepense (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50),
    nom VARCHAR(100) NOT NULL,
    createdBy VARCHAR(255),
    createdDate DATETIME,
    lastModifiedBy VARCHAR(255),
    lastModifiedDate DATETIME
);

-- Recreate Depense table with auto-increment
CREATE TABLE Depense (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    facture VARCHAR(100),
    tva DECIMAL(5,2) DEFAULT 0,
    valeurTtc DECIMAL(10,2) NOT NULL,
    datePaiement DATE NOT NULL,
    categorie_depense_id BIGINT NOT NULL,
    createdBy VARCHAR(255),
    createdDate DATETIME,
    lastModifiedBy VARCHAR(255),
    lastModifiedDate DATETIME,
    FOREIGN KEY (categorie_depense_id) REFERENCES CategorieDepense(id)
);

-- Insert sample categories
INSERT INTO CategorieDepense (code, nom, createdBy, createdDate, lastModifiedBy, lastModifiedDate) VALUES
('FOURNITURES', 'Fournitures de bureau', 'admin', NOW(), 'admin', NOW()),
('EQUIPEMENT', 'Équipement sportif', 'admin', NOW(), 'admin', NOW()),
('MAINTENANCE', 'Maintenance', 'admin', NOW(), 'admin', NOW()),
('ELECTRICITE', 'Électricité', 'admin', NOW(), 'admin', NOW()),
('EAU', 'Eau', 'admin', NOW(), 'admin', NOW());

-- Insert sample expenses
INSERT INTO Depense (nom, description, facture, tva, valeurTtc, datePaiement, categorie_depense_id, createdBy, createdDate, lastModifiedBy, lastModifiedDate) VALUES
('Papier A4', 'Ramettes de papier pour administration', 'F001', 20.00, 120.00, '2024-01-15', 1, 'admin', NOW(), 'admin', NOW()),
('Haltères 20kg', 'Paire d\'haltères pour salle de musculation', 'F002', 20.00, 240.00, '2024-01-20', 2, 'admin', NOW(), 'admin', NOW()),
('Réparation climatisation', 'Maintenance annuelle système climatisation', 'F003', 20.00, 600.00, '2024-02-01', 3, 'admin', NOW(), 'admin', NOW()),
('Facture électricité janvier', 'Consommation électrique janvier 2024', 'EDF001', 20.00, 450.00, '2024-02-15', 4, 'admin', NOW(), 'admin', NOW()),
('Facture eau janvier', 'Consommation eau janvier 2024', 'VEOLIA001', 10.00, 110.00, '2024-02-15', 5, 'admin', NOW(), 'admin', NOW());