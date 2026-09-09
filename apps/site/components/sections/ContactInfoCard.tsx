import Link from "next/link";
import { Envelope, MapPin, Phone } from "@phosphor-icons/react/ssr";
import { contactDetails, socialLinks } from "@/content/site";
import { socialIconMap } from "@/components/ui/BrandIcons";
import styles from "./ContactInfoCard.module.css";

export function ContactInfoCard() {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Fale connosco diretamente</h3>
      <ul className={styles.rows}>
        <li className={styles.row}>
          <MapPin aria-hidden="true" size={18} weight="duotone" color="currentColor" />
          <span>{contactDetails.address}</span>
        </li>
        <li className={styles.row}>
          <Envelope aria-hidden="true" size={18} weight="duotone" color="currentColor" />
          <Link className={styles.rowLink} href={`mailto:${contactDetails.email}`}>
            {contactDetails.email}
          </Link>
        </li>
        <li className={styles.row}>
          <Phone aria-hidden="true" size={18} weight="duotone" color="currentColor" />
          <Link className={styles.rowLink} href={contactDetails.whatsappHref} target="_blank" rel="noopener noreferrer">
            {contactDetails.phone}
          </Link>
        </li>
      </ul>
      <div className={styles.divider} />
      <p className={styles.socialLabel}>Siga-nos</p>
      <ul className={styles.socials} aria-label="Redes sociais">
        {socialLinks.map((social) => {
          const Icon = socialIconMap[social.icon];
          return (
            <li key={social.href}>
              <Link
                aria-label={social.label}
                className={styles.socialLink}
                href={social.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon aria-hidden="true" size={18} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
