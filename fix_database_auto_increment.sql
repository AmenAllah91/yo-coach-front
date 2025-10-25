-- Fix auto-increment for CategorieDepense table
ALTER TABLE CategorieDepense MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;

-- Fix auto-increment for Depense table  
ALTER TABLE Depense MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;

-- If the tables don't exist yet, create them with proper auto-increment
CREATE TABLE IF NOT EXISTS CategorieDepense (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50),
    nom VARCHAR(100) NOT NULL,
    createdBy VARCHAR(255),
    createdDate DATETIME,
    lastModifiedBy VARCHAR(255),
    lastModifiedDate DATETIME
);

CREATE TABLE IF NOT EXISTS Depense (
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